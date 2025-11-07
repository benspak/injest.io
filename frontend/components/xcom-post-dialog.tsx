'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiClient } from '@/lib/api';
import { XComConnectDialog } from '@/components/xcom-connect-dialog';

interface XComPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function XComPostDialog({ open, onOpenChange, onSuccess }: XComPostDialogProps) {
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const checkConnectionStatus = useCallback(async () => {
    setChecking(true);
    try {
      const status = await apiClient.getXComStatus();
      setConnected(status.connected);
    } catch (error) {
      console.error('Error checking X.com connection:', error);
      setConnected(false);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void checkConnectionStatus();
    }
  }, [checkConnectionStatus, open]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }
      setImage(file);
      setError(null);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!connected) {
      setShowConnectDialog(true);
      return;
    }

    if (!description.trim()) {
      setError('Please enter a description');
      return;
    }
    if (!image) {
      setError('Please select an image');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiClient.postToXCom(image, description.trim());
      // Reset form
      setDescription('');
      setImage(null);
      setImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onOpenChange(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to post to X.com';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleConnected = () => {
    setConnected(true);
    setShowConnectDialog(false);
    void checkConnectionStatus();
  };

  const handleClose = () => {
    if (!loading) {
      setDescription('');
      setImage(null);
      setImagePreview(null);
      setError(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onOpenChange(false);
    }
  };

  const characterCount = description.length;
  const maxCharacters = 280;

  if (checking) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Post to X.com</DialogTitle>
            <DialogDescription>
              Checking connection status...
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!connected) {
    return (
      <>
        <Dialog open={open} onOpenChange={handleClose}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Post to X.com</DialogTitle>
              <DialogDescription>
                Connect your X.com account to post images and descriptions
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md mb-4">
                <p className="text-sm text-yellow-800">
                  You need to connect your X.com account before you can post.
                </p>
              </div>
              <Button
                onClick={() => setShowConnectDialog(true)}
                className="w-full"
              >
                Connect X.com Account
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <XComConnectDialog
          open={showConnectDialog}
          onOpenChange={setShowConnectDialog}
          onConnected={handleConnected}
        />
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Post to X.com</DialogTitle>
            <DialogDescription>
              Share an image with a description on X.com (formerly Twitter)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
          <div>
            <Textarea
              placeholder="What&apos;s happening?"
              value={description}
              onChange={(e) => {
                const value = e.target.value;
                if (value.length <= maxCharacters) {
                  setDescription(value);
                  setError(null);
                }
              }}
              className="min-h-[100px] resize-none"
              maxLength={maxCharacters}
            />
            <div className="mt-1 text-right text-sm text-muted-foreground">
              {characterCount}/{maxCharacters}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                {image ? 'Change Image' : 'Select Image'}
              </Button>
              {image && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveImage}
                  disabled={loading}
                >
                  Remove
                </Button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            {imagePreview && image && (
              <div className="mt-2">
                <div className="relative w-full max-h-[300px]">
                  <Image
                    src={imagePreview}
                    alt="Preview"
                    width={600}
                    height={400}
                    className="h-full max-h-[300px] w-full max-w-full rounded-md border object-contain"
                    unoptimized
                  />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {image.name} ({(image.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !description.trim() || !image}
          >
            {loading ? 'Posting...' : 'Post to X.com'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <XComConnectDialog
      open={showConnectDialog}
      onOpenChange={setShowConnectDialog}
      onConnected={handleConnected}
    />
    </>
  );
}
