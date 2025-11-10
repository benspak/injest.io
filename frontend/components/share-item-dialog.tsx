import { FormEvent, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ApiError, apiClient } from '@/lib/api';
import { buildItemShareUrl } from '@/lib/utils';

interface ShareItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId?: string;
  itemTitle?: string;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ShareItemDialog({ open, onOpenChange, itemId, itemTitle }: ShareItemDialogProps) {
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  useEffect(() => {
    if (!open) {
      setEmail('');
      setErrorMessage(null);
      setIsSending(false);
      setIsCopying(false);
    }
  }, [open, itemId]);

  const shareUrl = useMemo(() => {
    if (!itemId) {
      return '';
    }
    try {
      return buildItemShareUrl(itemId);
    } catch {
      return '';
    }
  }, [itemId]);

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!itemId) {
      toast.error('Unable to share this item right now.');
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !emailPattern.test(trimmedEmail.toLowerCase())) {
      setErrorMessage('Enter a valid email address.');
      return;
    }

    setErrorMessage(null);
    setIsSending(true);

    try {
      await apiClient.shareItemByEmail(itemId, trimmedEmail);
      toast.success(`Sent item to ${trimmedEmail}.`);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to send share email', error);
      if (error instanceof ApiError) {
        toast.error(error.message);
        if (error.status === 400) {
          setErrorMessage(error.message);
        }
      } else {
        toast.error('Unable to send share email. Please try again.');
      }
    } finally {
      setIsSending(false);
    }
  };

  const copyShareLink = async () => {
    if (!itemId || !shareUrl) {
      toast.error('Share link unavailable.');
      return;
    }

    try {
      setIsCopying(true);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.setAttribute('readonly', '');
        textArea.style.position = 'absolute';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
        } finally {
          document.body.removeChild(textArea);
        }
      }
      toast.success('Share link copied to clipboard.');
    } catch (error) {
      console.error('Failed to copy share link', error);
      toast.error('Unable to copy share link.');
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isSending) {
          onOpenChange(next);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSend} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Share item</DialogTitle>
            <DialogDescription>
              Send {itemTitle ? `"${itemTitle}"` : 'this item'} to a teammate via email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="share-email">
              Recipient email
            </label>
            <Input
              id="share-email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (errorMessage) {
                  setErrorMessage(null);
                }
              }}
              placeholder="person@example.com"
              autoFocus
              disabled={isSending}
              required
            />
            {errorMessage ? (
              <p className="text-xs text-red-500">{errorMessage}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                We’ll send the item details and a link to view it on Injest.
              </p>
            )}
          </div>
          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={copyShareLink}
              disabled={isSending || isCopying || !shareUrl}
            >
              {isCopying ? 'Copying…' : 'Copy link'}
            </Button>
            <div className="flex w-full justify-end gap-2 sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSending || !itemId}>
                {isSending ? 'Sending…' : 'Send'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
