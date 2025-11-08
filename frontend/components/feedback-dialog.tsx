'use client';

import { useCallback, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { apiClient, ApiError } from '@/lib/api';

type FeedbackDialogProps = {
  userEmail?: string | null;
  buttonVariant?: ButtonProps['variant'];
  buttonSize?: ButtonProps['size'];
  triggerClassName?: string;
  buttonText?: string;
};

export function FeedbackDialog({
  userEmail,
  buttonVariant = 'outline',
  buttonSize = 'sm',
  triggerClassName,
  buttonText = 'Feedback',
}: FeedbackDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setTitle('');
    setMessage('');
    setImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      setImage(null);
      return;
    }

    if (!selectedFile.type.startsWith('image/')) {
      toast.error('Only image files are allowed as attachments.');
      event.target.value = '';
      return;
    }

    setImage(selectedFile);
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const trimmedTitle = title.trim();
      const trimmedMessage = message.trim();

      if (!trimmedTitle) {
        toast.error('Please provide a title for your feedback.');
        return;
      }

      if (!trimmedMessage) {
        toast.error('Please provide a message for your feedback.');
        return;
      }

      setIsSubmitting(true);

      try {
        await apiClient.submitFeedback({
          title: trimmedTitle,
          message: `${trimmedMessage}${userEmail ? `\n\nSubmitted by: ${userEmail}` : ''}`,
          image: image ?? undefined,
        });

        toast.success('Thanks for the feedback!');
        resetForm();
        setOpen(false);
      } catch (error: unknown) {
        let errorMessage = 'Failed to send feedback.';

        if (error instanceof ApiError) {
          errorMessage = error.message || error.data?.error || errorMessage;
        } else if (error instanceof Error && error.message) {
          errorMessage = error.message;
        }

        toast.error(errorMessage);
      } finally {
        setIsSubmitting(false);
      }
    },
    [image, message, resetForm, title, userEmail]
  );

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) {
        resetForm();
      }
      setOpen(nextOpen);
    }}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={buttonVariant}
          size={buttonSize}
          className={triggerClassName}
        >
          {buttonText}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
          <DialogDescription>
            Share your thoughts with the Injest team. Attach an optional screenshot or image if it helps explain your feedback.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="feedback-title">Title</Label>
            <Input
              id="feedback-title"
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Quick summary of your feedback"
              maxLength={200}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="feedback-message">Message</Label>
            <Textarea
              id="feedback-message"
              name="message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Describe your idea, issue, or feedback in detail"
              rows={5}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="feedback-image">Attachment (optional)</Label>
            <Input
              id="feedback-image"
              name="image"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              ref={fileInputRef}
            />
            <p className="text-xs text-muted-foreground">
              Upload a single image (max 5MB). This is optional.
            </p>
            {image && (
              <div className="flex items-center justify-between rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                <span className="truncate">{image.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setImage(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                >
                  Remove
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sending...' : 'Send Feedback'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
