'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { SubscriptionPaymentDialog } from '@/components/subscription-payment-dialog';

interface CaptureFormProps {
  onItemCreated?: () => void;
}

export function CaptureForm({ onItemCreated }: CaptureFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load item count and limit status
  const loadItemLimitStatus = async () => {
    try {
      const response = await apiClient.getIndexedItemCount();
      setItemCount(response.count);
      setIsAtLimit(response.isAtLimit || false);
      setIsApproachingLimit(response.isApproachingLimit || false);
      setLimit(response.limit || null);
    } catch (error) {
      console.error('Error loading item limit status:', error);
    }
  };

  // Load limit status on mount
  useEffect(() => {
    loadItemLimitStatus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // Validate that at least one field is provided
    if (!title && !description && !url && files.length === 0) {
      setMessage('Please provide at least a title, description, URL, or attachment');
      setLoading(false);
      return;
    }

    // Check limit status before submission
    try {
      const limitStatus = await apiClient.getIndexedItemCount();

      // If at limit, show subscription dialog immediately
      if (limitStatus.isAtLimit && limitStatus.limit !== null) {
        setPendingFormValues({
          title,
          description,
          url,
          notes,
          files: [...files],
        });
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

      // Check if this is a batch processing response
      if (response && typeof response === 'object' && 'batch' in response && response.batch === true) {
        const batchResponse = response as {
          batch: boolean;
          total: number;
          created: number;
          failed: number;
          items?: any[];
          errors?: Array<{ filename: string; error: string }>;
        };

        if (batchResponse.created > 0) {
          if (batchResponse.failed > 0) {
            setMessage(
              `Successfully created ${batchResponse.created} item(s). ${batchResponse.failed} file(s) failed to process.`
            );
          } else {
            setMessage(`Successfully created ${batchResponse.created} item(s)!`);
          }
        } else {
          setMessage(`Failed to process all ${batchResponse.total} file(s).`);
        }
      } else {
        // Single item response
        setMessage('Item created successfully!');
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

      // Notify parent component to refresh items list
      if (onItemCreated) {
        onItemCreated();
      }
    } catch (error: any) {
      // Extract error message from API response
      let errorMessage = 'Failed to create item';

      if (error.message) {
        errorMessage = error.message;

        // Check for item limit exceeded error
        if (errorMessage.includes('Item limit exceeded') || errorMessage.includes('item limit')) {
          // Store form values for retry after subscription (FormData can't be stored in state)
          setPendingFormValues({
            title,
            description,
            url,
            notes,
            files: [...files], // Create a copy of the files array
          });
          setShowSubscriptionDialog(true);
          setMessage('');
          setLoading(false);
          return;
        }

        // Provide more user-friendly messages for specific errors
        if (errorMessage.includes('File too large') || errorMessage.includes('LIMIT_FILE_SIZE')) {
          errorMessage = 'File too large. Maximum file size is 50MB. Please choose a smaller file.';
        } else if (errorMessage.includes('Too many files') || errorMessage.includes('LIMIT_FILE_COUNT')) {
          errorMessage = 'Too many files. You can upload a maximum of 500 files at once.';
        } else if (errorMessage.includes('File upload error')) {
          errorMessage = 'File upload failed. Please try again or choose a different file.';
        }
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
        setMessage('Premium subscription activated! Retrying upload...');

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

            // Check if this is a batch processing response
            if (response && typeof response === 'object' && 'batch' in response && response.batch === true) {
              const batchResponse = response as {
                batch: boolean;
                total: number;
                created: number;
                failed: number;
                items?: any[];
                errors?: Array<{ filename: string; error: string }>;
              };

              if (batchResponse.created > 0) {
                if (batchResponse.failed > 0) {
                  setMessage(
                    `Successfully created ${batchResponse.created} item(s). ${batchResponse.failed} file(s) failed to process.`
                  );
                } else {
                  setMessage(`Successfully created ${batchResponse.created} item(s)!`);
                }
              } else {
                setMessage(`Failed to process all ${batchResponse.total} file(s).`);
              }
            } else {
              setMessage('Item created successfully!');
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

            // Notify parent component to refresh items list
            if (onItemCreated) {
              onItemCreated();
            }
          } catch (retryError: any) {
            setMessage(retryError.message || 'Failed to create item after subscription');
          } finally {
            setLoading(false);
          }
        }
      }
    } catch (error: any) {
      setMessage('Failed to verify subscription. Please try again.');
    }
  };

  const handleSubscriptionCancel = () => {
    setShowSubscriptionDialog(false);
    setPendingFormValues(null);
    setMessage('You can delete some items to stay within the free tier limit, or subscribe to premium for unlimited items.');
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
      </CardHeader>
      <CardContent>
        {/* Warning banner when approaching limit */}
        {isApproachingLimit && limit !== null && itemCount !== null && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800 font-medium">
              ⚠️ You're approaching the limit: {itemCount} / {limit} indexed items
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
              🚫 You've reached the limit: {itemCount} / {limit} indexed items
            </p>
            <p className="text-xs text-red-700 mt-1">
              Please subscribe to Premium ($5/month) to create more items.
            </p>
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
                Processing
              </span>
            ) : isAtLimit && limit !== null ? (
              'Limit Reached - Subscribe to Continue'
            ) : files.length > 1 ? (
              'Process Uploads'
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
      />
    </Card>
  );
}
