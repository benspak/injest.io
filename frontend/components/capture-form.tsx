'use client';

import Link from 'next/link';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient, type UploadAcknowledgement, ApiError } from '@/lib/api';
import { SubscriptionPaymentDialog } from '@/components/subscription-payment-dialog';
import { SUBSCRIPTION_PLANS, type SubscriptionTier } from '@/lib/subscriptionPlans';
import { ITEM_CREATED_EVENT } from '@/lib/events';

interface CaptureFormProps {
  onItemCreated?: () => void;
}

const isUploadAcknowledgement = (value: unknown): value is UploadAcknowledgement => {
  return typeof value === 'object' && value !== null && 'queued' in value;
};

export function CaptureForm({ onItemCreated }: CaptureFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [duplicateConflicts, setDuplicateConflicts] = useState<
    Array<{ filename: string; itemId: string; title?: string | null }>
  >([]);
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);
  const [pendingFormValues, setPendingFormValues] = useState<{
    title: string;
    description: string;
    url: string;
    notes: string;
    files: File[];
  } | null>(null);
  const [itemCount, setItemCount] = useState<number | null>(null);
  const [isAtLimit, setIsAtLimit] = useState(false);
  const [isApproachingLimit, setIsApproachingLimit] = useState(false);
  const [limit, setLimit] = useState<number | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>('free');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load item count and limit status
  const loadItemLimitStatus = useCallback(async () => {
    try {
      const response = await apiClient.getIndexedItemCount();
      setItemCount(response.count);
      setIsAtLimit(response.isAtLimit || false);
      setIsApproachingLimit(response.isApproachingLimit || false);
      setLimit(typeof response.limit === 'number' ? response.limit : null);
      if (response.subscriptionTier) {
        setSubscriptionTier(response.subscriptionTier);
      } else {
        setSubscriptionTier('free');
      }
    } catch (error) {
      console.error('Error loading item limit status:', error);
    }
  }, []);

  // Load limit status on mount
  useEffect(() => {
    void loadItemLimitStatus();
  }, [loadItemLimitStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setDuplicateConflicts([]);

    // Validate that at least one field is provided
    if (!title && !description && !url && files.length === 0) {
      setMessage('Please provide at least a title, description, URL, or attachment');
      setLoading(false);
      return;
    }

    // Check limit status before submission
    try {
      const limitStatus = await apiClient.getIndexedItemCount();
      setItemCount(limitStatus.count);
      setIsAtLimit(limitStatus.isAtLimit);
      setIsApproachingLimit(limitStatus.isApproachingLimit);
      setLimit(typeof limitStatus.limit === 'number' ? limitStatus.limit : null);
      const tierFromStatus: SubscriptionTier = limitStatus.subscriptionTier ?? 'free';
      setSubscriptionTier(tierFromStatus);
      const plan = SUBSCRIPTION_PLANS[tierFromStatus];

      // If at limit, show subscription dialog immediately
      if (limitStatus.isAtLimit && typeof limitStatus.limit === 'number') {
        setPendingFormValues({
          title,
          description,
          url,
          notes,
          files: [...files],
        });
        setMessage(
          `You have reached the ${plan.name} plan limit of ${limitStatus.limit.toLocaleString()} indexed items.`
        );
        setShowSubscriptionDialog(true);
        setLoading(false);
        return;
      }
    } catch (error) {
      // If limit check fails, continue with submission (backend will handle it)
      console.error('Error checking limit status:', error);
    }

    // Create form data outside try block so it's accessible in catch block
    const formData = new FormData();

    if (title) formData.append('title', title);
    if (description) formData.append('description', description);
    if (url) formData.append('url', url);
    if (notes) formData.append('notes', notes);

    // Add file attachments
    files.forEach((file) => {
      formData.append('attachments', file);
    });

    try {
      const response = await apiClient.createItem(formData);

      if (isUploadAcknowledgement(response)) {
        const duplicates = response.duplicates ?? [];
        setDuplicateConflicts(duplicates);

        const fallbackMessage = (() => {
          if (response.uploadedCount > 0) {
            const duplicateNote =
              response.duplicateCount > 0
                ? ` Skipped ${response.duplicateCount} duplicate(s).`
                : '';
            return `Queued ${response.uploadedCount} file(s) for processing.${duplicateNote} Processing may take a few minutes.`;
          }
          if (duplicates.length > 0) {
            return 'All selected files are already saved.';
          }
          return 'No files were queued for processing.';
        })();

        setMessage(response.message || fallbackMessage);
      } else {
        setDuplicateConflicts([]);
        setMessage('Upload successful! Processing may take a few minutes.');

        // Notify parent component to refresh items list
        if (onItemCreated) {
          onItemCreated();
        }
        window.dispatchEvent(new Event(ITEM_CREATED_EVENT));
      }

      // Reset form
      setTitle('');
      setDescription('');
      setUrl('');
      setNotes('');
      setFiles([]);

      // Clear file input element
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Reload limit status after successful creation
      await loadItemLimitStatus();
    } catch (error: unknown) {
      setDuplicateConflicts([]);

      let errorMessage = 'Failed to create item';
      let duplicateList: Array<{ filename: string; itemId: string; title?: string | null }> = [];
      const originalMessage =
        error instanceof Error && typeof error.message === 'string'
          ? error.message
          : '';

      if (error instanceof ApiError) {
        const data = error.data as { duplicates?: Array<{ filename: string; itemId: string; title?: string | null }> } | undefined;
        if (error.status === 409 && data?.duplicates && Array.isArray(data.duplicates)) {
          duplicateList = data.duplicates;
          setDuplicateConflicts(duplicateList);

          if (duplicateList.length === 1) {
            const [duplicate] = duplicateList;
            errorMessage = `Looks like "${duplicate.filename}" is already saved${duplicate.title ? ` as "${duplicate.title}"` : ''}.`;
          } else if (duplicateList.length > 1) {
            errorMessage = `We found ${duplicateList.length} files that are already saved in your workspace.`;
          } else {
            errorMessage = 'Duplicate file upload detected. These files are already saved.';
          }
        } else {
          errorMessage = error.message || errorMessage;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }

      const lowerMessage = errorMessage.toLowerCase();
      if (lowerMessage.includes('item limit exceeded') || lowerMessage.includes('item limit')) {
        setPendingFormValues({
          title,
          description,
          url,
          notes,
          files: [...files],
        });
        setShowSubscriptionDialog(true);
        setMessage('');
        return;
      }

      if (
        errorMessage.includes('File too large') ||
        originalMessage.includes('File too large') ||
        originalMessage.includes('LIMIT_FILE_SIZE')
      ) {
        errorMessage = 'File too large. Maximum file size is 50MB. Please choose a smaller file.';
      } else if (
        errorMessage.includes('Too many files') ||
        originalMessage.includes('Too many files') ||
        originalMessage.includes('LIMIT_FILE_COUNT')
      ) {
        errorMessage = 'Too many files. You can upload a maximum of 1000 files at once.';
      } else if (
        errorMessage.includes('File upload error') ||
        originalMessage.includes('File upload error')
      ) {
        errorMessage = 'File upload failed. Please try again or choose a different file.';
      }

      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscriptionComplete = async (paymentIntentId: string) => {
    try {
      // Verify payment
      const verification = await apiClient.verifyPayment(paymentIntentId);

      if (verification.verified && verification.premium) {
        const newTier: SubscriptionTier = verification.subscriptionTier ?? 'plus';
        const plan = SUBSCRIPTION_PLANS[newTier] ?? SUBSCRIPTION_PLANS.plus;
        setSubscriptionTier(newTier);
        setMessage(`${plan.name} plan activated! Retrying upload...`);

        // Reload limit status after premium activation
        await loadItemLimitStatus();

        // Retry the upload with the pending form values
        if (pendingFormValues) {
          setLoading(true);
          try {
            // Recreate FormData from stored values
            const retryFormData = new FormData();

            if (pendingFormValues.title) retryFormData.append('title', pendingFormValues.title);
            if (pendingFormValues.description) retryFormData.append('description', pendingFormValues.description);
            if (pendingFormValues.url) retryFormData.append('url', pendingFormValues.url);
            if (pendingFormValues.notes) retryFormData.append('notes', pendingFormValues.notes);

            // Add file attachments
            pendingFormValues.files.forEach((file) => {
              retryFormData.append('attachments', file);
            });

            const response = await apiClient.createItem(retryFormData);

            if (isUploadAcknowledgement(response)) {
              const duplicates = response.duplicates ?? [];
              setDuplicateConflicts(duplicates);

              const fallbackMessage = (() => {
                if (response.uploadedCount > 0) {
                  const duplicateNote =
                    response.duplicateCount > 0
                      ? ` Skipped ${response.duplicateCount} duplicate(s).`
                      : '';
                  return `Queued ${response.uploadedCount} file(s) for processing.${duplicateNote} Processing may take a few minutes.`;
                }
                if (duplicates.length > 0) {
                  return 'All selected files are already saved.';
                }
                return 'No files were queued for processing.';
              })();

              setMessage(response.message || fallbackMessage);
            } else {
              setDuplicateConflicts([]);
              setMessage('Upload successful! Processing may take a few minutes.');
            }

            // Reset form
            setTitle('');
            setDescription('');
            setUrl('');
            setNotes('');
            setFiles([]);
            setPendingFormValues(null);

            // Clear file input element
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }

            // Reload limit status after successful creation
            await loadItemLimitStatus();

            if (!isUploadAcknowledgement(response)) {
              if (onItemCreated) {
                onItemCreated();
              }
              window.dispatchEvent(new Event(ITEM_CREATED_EVENT));
            }
          } catch (retryError: unknown) {
            const message = retryError instanceof Error ? retryError.message : 'Failed to create item after subscription';
            setMessage(message);
          } finally {
            setLoading(false);
          }
        }
      }
    } catch (error: unknown) {
      setMessage('Failed to verify subscription. Please try again.');
    }
  };

  const handleSubscriptionCancel = () => {
    setShowSubscriptionDialog(false);
    setPendingFormValues(null);
    const currentPlan = SUBSCRIPTION_PLANS[subscriptionTier] ?? SUBSCRIPTION_PLANS.free;
    setMessage(
      `You can delete some items to stay within the ${currentPlan.name} plan limit, or upgrade to a higher tier whenever you’re ready.`
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Capture New Item</CardTitle>
        <p className="text-sm text-muted-foreground">
          New: Install the{' '}
          <Link
            href="https://chromewebstore.google.com/detail/injest-capture/goiocnfkcilgalpmbjbkhdjdblcokpjl"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 text-blue-600 hover:text-blue-500"
          >
            Injest Capture Chrome extension
          </Link>{' '}
          to save items to your workspace with CMD+SHIFT+V.
        </p>
      </CardHeader>
      <CardContent>
        {/* Warning banner when approaching limit */}
        {isApproachingLimit && limit !== null && itemCount !== null && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800 font-medium">
              ⚠️ You&apos;re approaching the limit: {itemCount} / {limit} indexed items
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Consider subscribing to Premium ($5/month) for unlimited items.
            </p>
          </div>
        )}

        {/* Error banner when at limit */}
        {isAtLimit && limit !== null && itemCount !== null && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800 font-medium">
              🚫 You&apos;ve reached the limit: {itemCount} / {limit} indexed items
            </p>
            <p className="text-xs text-red-700 mt-1 mb-3">
              Please subscribe to Premium ($5/month) to create more items.
            </p>
            <Button
              onClick={() => setShowSubscriptionDialog(true)}
              className="w-full sm:w-auto"
              variant="default"
            >
              Subscribe to Premium
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <Input
            type="text"
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <Textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[100px]"
          />

          <Input
            type="url"
            placeholder="URL (optional)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />

          <Input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileChange}
          />

          {files.length > 0 && (
            <div className="text-sm text-muted-foreground">
              {files.length} file(s) selected
            </div>
          )}

          <Textarea
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[80px]"
          />

          <Button
            type="submit"
            className="w-full"
            disabled={loading || (isAtLimit && limit !== null)}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Uploading
              </span>
            ) : isAtLimit && limit !== null ? (
              'Limit Reached - Subscribe to Continue'
            ) : files.length > 1 ? (
              'Upload'
            ) : (
              'Create Item'
            )}
          </Button>

          {message && (
            <p className={`text-sm ${message.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
              {message}
            </p>
          )}

        </form>
      </CardContent>

      <SubscriptionPaymentDialog
        open={showSubscriptionDialog}
        onOpenChange={setShowSubscriptionDialog}
        onPaymentComplete={handleSubscriptionComplete}
        onCancel={handleSubscriptionCancel}
        currentTier={subscriptionTier}
        currentLimit={limit}
        currentCount={itemCount}
      />
    </Card>
  );
}
