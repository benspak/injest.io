import { FormEvent, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ApiError, apiClient, Collection } from '@/lib/api';

interface ShareCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionId?: string;
  collectionTitle?: string;
  onSuccess?: () => void;
}

export function ShareCollectionDialog({
  open,
  onOpenChange,
  collectionId,
  collectionTitle,
  onSuccess
}: ShareCollectionDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [postToProfile, setPostToProfile] = useState(false);
  const [enableSharing, setEnableSharing] = useState(false);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setIsSaving(false);
      setIsCopying(false);
      setPostToProfile(false);
      setEnableSharing(false);
      setCollection(null);
      setShareToken(null);
    }
  }, [open, collectionId]);

  useEffect(() => {
    const fetchCollection = async () => {
      if (open && collectionId) {
        try {
          const fetchedCollection = await apiClient.getCollection(collectionId);
          setCollection(fetchedCollection);
          setPostToProfile(fetchedCollection.posted_to_profile || false);
          setEnableSharing(fetchedCollection.is_publicly_shareable || false);
          setShareToken(fetchedCollection.share_token || null);
        } catch (error) {
          console.error('Failed to fetch collection:', error);
          toast.error('Failed to load collection');
        }
      }
    };

    void fetchCollection();
  }, [open, collectionId]);

  // Fetch share token when sharing is enabled
  useEffect(() => {
    const fetchToken = async () => {
      if (open && collectionId && enableSharing && !shareToken) {
        try {
          const tokenResponse = await apiClient.getCollectionShareToken(collectionId);
          setShareToken(tokenResponse.share_token || null);
        } catch (error) {
          console.error('Failed to fetch share token:', error);
        }
      }
    };

    void fetchToken();
  }, [open, collectionId, enableSharing, shareToken]);

  const shareUrl = useMemo(() => {
    if (!shareToken) {
      return '';
    }
    try {
      const runtimeOrigin =
        typeof window !== 'undefined' ? window.location.origin : '';
      return `${runtimeOrigin}/c/${shareToken}`;
    } catch {
      return '';
    }
  }, [shareToken]);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!collectionId) {
      toast.error('Unable to share this collection right now.');
      return;
    }

    setIsSaving(true);

    try {
      // Update post to profile
      if (postToProfile && (!collection || !collection.posted_to_profile)) {
        await apiClient.postCollectionToProfile(collectionId);
      } else if (!postToProfile && collection?.posted_to_profile) {
        await apiClient.removeCollectionFromProfile(collectionId);
      }

      // Update sharing settings
      if (enableSharing !== (collection?.is_publicly_shareable || false)) {
        await apiClient.updateCollectionSharing(collectionId, enableSharing);
        // Fetch updated token if sharing was enabled
        if (enableSharing) {
          const tokenResponse = await apiClient.getCollectionShareToken(collectionId);
          setShareToken(tokenResponse.share_token || null);
        } else {
          setShareToken(null);
        }
      }

      const actions = [];
      if (postToProfile) actions.push('posted to profile');
      if (enableSharing) actions.push('sharing enabled');
      if (!postToProfile && collection?.posted_to_profile) actions.push('removed from profile');
      if (!enableSharing && collection?.is_publicly_shareable) actions.push('sharing disabled');

      if (actions.length > 0) {
        toast.success(`Collection ${actions.join(' and ')}.`);
      }

      onOpenChange(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Failed to update collection sharing', error);
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('Unable to update collection sharing. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const copyShareLink = async () => {
    if (!shareToken || !shareUrl) {
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
        if (!isSaving) {
          onOpenChange(next);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSave} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Share collection</DialogTitle>
            <DialogDescription>
              Share {collectionTitle ? `"${collectionTitle}"` : 'this collection'} publicly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="post-to-profile"
                  checked={postToProfile}
                  onChange={(e) => {
                    setPostToProfile(e.target.checked);
                  }}
                  disabled={isSaving}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="post-to-profile" className="text-sm font-medium cursor-pointer">
                  Post to profile
                </label>
              </div>
              <p className="text-xs text-muted-foreground ml-6">
                Make this collection visible on your public profile at injest.io/u/{'[your-username]'}
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="enable-sharing"
                  checked={enableSharing}
                  onChange={(e) => {
                    setEnableSharing(e.target.checked);
                  }}
                  disabled={isSaving}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="enable-sharing" className="text-sm font-medium cursor-pointer">
                  Enable public link sharing
                </label>
              </div>
              <p className="text-xs text-muted-foreground ml-6">
                Generate a shareable link that anyone can use to view this collection.
              </p>
            </div>
            {enableSharing && shareUrl && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Share link</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-50"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={copyShareLink}
                    disabled={isSaving || isCopying || !shareUrl}
                    size="sm"
                  >
                    {isCopying ? 'Copying…' : 'Copy'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this link with anyone to let them view the collection.
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !collectionId}>
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
