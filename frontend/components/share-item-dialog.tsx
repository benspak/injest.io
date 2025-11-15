import { FormEvent, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ApiError, apiClient, Item } from '@/lib/api';
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
  const [postToProfile, setPostToProfile] = useState(false);
  const [isPostingToProfile, setIsPostingToProfile] = useState(false);
  const [item, setItem] = useState<Item | null>(null);

  useEffect(() => {
    if (!open) {
      setEmail('');
      setErrorMessage(null);
      setIsSending(false);
      setIsCopying(false);
      setPostToProfile(false);
      setIsPostingToProfile(false);
      setItem(null);
    }
  }, [open, itemId]);

  useEffect(() => {
    const fetchItem = async () => {
      if (open && itemId) {
        try {
          const fetchedItem = await apiClient.getItem(itemId);
          setItem(fetchedItem);
          setPostToProfile(fetchedItem.posted_to_profile || false);
        } catch (error) {
          console.error('Failed to fetch item:', error);
        }
      }
    };

    void fetchItem();
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
    const hasEmail = trimmedEmail && emailPattern.test(trimmedEmail.toLowerCase());

    // At least one action must be selected
    if (!hasEmail && !postToProfile) {
      setErrorMessage('Please enter an email address or select "Post to profile".');
      return;
    }

    if (trimmedEmail && !emailPattern.test(trimmedEmail.toLowerCase())) {
      setErrorMessage('Enter a valid email address.');
      return;
    }

    setErrorMessage(null);
    setIsSending(true);
    setIsPostingToProfile(true);

    try {
      // Send email if provided
      if (hasEmail) {
        await apiClient.shareItemByEmail(itemId, trimmedEmail);
      }

      // Post to profile if checkbox is checked and item is not already posted
      if (postToProfile && (!item || !item.posted_to_profile)) {
        await apiClient.postItemToProfile(itemId);
      }

      // Remove from profile if checkbox is unchecked and item is currently posted
      if (!postToProfile && item?.posted_to_profile) {
        await apiClient.removeItemFromProfile(itemId);
      }

      if (hasEmail && postToProfile) {
        toast.success(`Sent item to ${trimmedEmail} and posted to profile.`);
      } else if (hasEmail) {
        toast.success(`Sent item to ${trimmedEmail}.`);
      } else if (postToProfile) {
        toast.success('Item posted to profile.');
      } else {
        toast.success('Item removed from profile.');
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Failed to share item', error);
      if (error instanceof ApiError) {
        toast.error(error.message);
        if (error.status === 400) {
          setErrorMessage(error.message);
        }
      } else {
        toast.error('Unable to share item. Please try again.');
      }
    } finally {
      setIsSending(false);
      setIsPostingToProfile(false);
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
          <div className="space-y-4">
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
                disabled={isSending || isPostingToProfile}
              />
              {errorMessage ? (
                <p className="text-xs text-red-500">{errorMessage}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  We'll send the item details and a link to view it on Injest.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="post-to-profile"
                  checked={postToProfile}
                  onChange={(e) => {
                    setPostToProfile(e.target.checked);
                    if (errorMessage) {
                      setErrorMessage(null);
                    }
                  }}
                  disabled={isSending || isPostingToProfile}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="post-to-profile" className="text-sm font-medium cursor-pointer">
                  Post to profile
                </label>
              </div>
              <p className="text-xs text-muted-foreground ml-6">
                Make this item visible on your public profile at injest.io/u/{'[your-username]'}
              </p>
            </div>
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
                disabled={isSending || isPostingToProfile}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={(isSending || isPostingToProfile) || !itemId}>
                {isSending || isPostingToProfile ? 'Processing…' : 'Save'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
