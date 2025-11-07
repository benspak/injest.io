'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiClient } from '@/lib/api';

interface XComConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected?: () => void;
}

export function XComConnectDialog({ open, onOpenChange, onConnected }: XComConnectDialogProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ connected: boolean; username?: string } | null>(null);
  const [checking, setChecking] = useState(true);

  const checkStatus = useCallback(async () => {
    setChecking(true);
    try {
      const statusData = await apiClient.getXComStatus();
      setStatus(statusData);
    } catch (error) {
      console.error('Error checking X.com status:', error);
      setStatus({ connected: false });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void checkStatus();
    }
  }, [checkStatus, open]);

  const handleConnect = async () => {
    setLoading(true);
    try {
      await apiClient.initiateXComAuth();
      // The redirect will happen, so we don't need to handle response
    } catch (error: unknown) {
      console.error('Error initiating X.com auth:', error);
      const message = error instanceof Error ? error.message : 'Failed to connect to X.com';
      alert(message);
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await apiClient.disconnectXCom();
      setStatus({ connected: false });
      if (onConnected) {
        onConnected();
      }
    } catch (error: unknown) {
      console.error('Error disconnecting X.com:', error);
      const message = error instanceof Error ? error.message : 'Failed to disconnect from X.com';
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>X.com Connection</DialogTitle>
          <DialogDescription>
            Connect your X.com account to post images and descriptions
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {checking ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Checking connection status...</p>
            </div>
          ) : status?.connected ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm font-medium text-green-800">Connected</p>
                <p className="text-sm text-green-700 mt-1">
                  Connected as <strong>@{status.username}</strong>
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={handleDisconnect}
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Disconnecting...' : 'Disconnect'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
                <p className="text-sm text-gray-700">
                  You need to connect your X.com account to post images and descriptions.
                </p>
              </div>
              <Button
                onClick={handleConnect}
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Connecting...' : 'Connect X.com Account'}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
