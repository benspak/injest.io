'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { AvatarMenu } from '@/components/avatar-menu';
import { FeedbackDialog } from '@/components/feedback-dialog';
import { XComConnectDialog } from '@/components/xcom-connect-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';
import { apiClient } from '@/lib/api';

export default function SettingsPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [xcomConnectDialogOpen, setXcomConnectDialogOpen] = useState(false);
  const [xcomStatus, setXcomStatus] = useState<{ connected: boolean; username?: string } | null>(null);
  const [loadingXcomStatus, setLoadingXcomStatus] = useState(false);

  const loadXcomStatus = useCallback(async () => {
    setLoadingXcomStatus(true);
    try {
      const status = await apiClient.getXComStatus();
      setXcomStatus(status);
    } catch (error: unknown) {
      console.error('Error checking X.com status:', error);
      setXcomStatus({ connected: false });
    } finally {
      setLoadingXcomStatus(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await auth.restore();
      setAuthLoading(false);

      if (!auth.isAuthenticated()) {
        router.push('/login');
        return;
      }

      setAuthReady(true);
    };

    void init();
  }, [router]);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    void loadXcomStatus();
  }, [authReady, loadXcomStatus]);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const xcomConnected = params.get('xcom_connected');
    const xcomError = params.get('xcom_error');
    const username = params.get('username');

    if (xcomConnected === 'true') {
      toast.success(`Successfully connected to X.com as @${username || 'user'}!`);
      void loadXcomStatus();
      window.history.replaceState({}, '', '/settings');
    } else if (xcomError) {
      toast.error(`X.com connection failed: ${decodeURIComponent(xcomError)}`);
      window.history.replaceState({}, '', '/settings');
    }
  }, [authReady, loadXcomStatus]);

  if (authLoading) {
    return <div className="container mx-auto px-4 py-12">Loading...</div>;
  }

  if (!auth.isAuthenticated()) {
    return null;
  }

  const currentUser = auth.getUser();

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <header className="bg-white border-b">
        <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 flex justify-between items-center max-w-full">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
              ← Back to Dashboard
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold">Settings</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm"
            >
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm"
            >
              <Link href="/tasks">Tasks</Link>
            </Button>
            <FeedbackDialog
              userEmail={currentUser?.email}
              buttonVariant="outline"
              buttonSize="sm"
              triggerClassName="text-xs sm:text-sm"
            />
            <AvatarMenu user={currentUser} />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8 max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>X.com Connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingXcomStatus && !xcomStatus ? (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-md text-sm text-muted-foreground">
                Checking connection status...
              </div>
            ) : xcomStatus?.connected ? (
              <>
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm font-medium text-green-800">Connected</p>
                  <p className="text-sm text-green-700 mt-1">
                    @{xcomStatus.username}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => setXcomConnectDialogOpen(true)}
                >
                  Manage Connection
                </Button>
              </>
            ) : (
              <>
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                  <p className="text-sm text-gray-700">
                    You have not connected your X.com account yet.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => setXcomConnectDialogOpen(true)}
                >
                  Connect X.com
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Important Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <a
                href="https://x.com/settings/download_your_data"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                Download X (Twitter) Data
              </a>
              <a
                href="https://takeout.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                Google Takeout
              </a>
            </div>
          </CardContent>
        </Card>
      </main>

      <XComConnectDialog
        open={xcomConnectDialogOpen}
        onOpenChange={setXcomConnectDialogOpen}
        onConnected={() => {
          void loadXcomStatus();
        }}
      />
    </div>
  );
}
