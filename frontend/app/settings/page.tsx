'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import { AvatarMenu } from '@/components/avatar-menu';
import { FeedbackDialog } from '@/components/feedback-dialog';
import { AnnouncementBanner } from '@/components/announcement-banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { auth } from '@/lib/auth';
import { apiClient, type TwoFactorSetupResponse, type TwoFactorStatus } from '@/lib/api';
import { SubscriptionPaymentDialog } from '@/components/subscription-payment-dialog';
import type { SubscriptionTier } from '@/lib/subscriptionPlans';
import QRCode from 'qrcode';

function SettingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authLoading, setAuthLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus | null>(null);
  const [twoFactorLoading, setTwoFactorLoading] = useState(true);
  const [twoFactorError, setTwoFactorError] = useState('');
  const [twoFactorMessage, setTwoFactorMessage] = useState('');
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetupResponse | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [disableMode, setDisableMode] = useState(false);
  const [disableUseRecovery, setDisableUseRecovery] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [disableRecoveryCode, setDisableRecoveryCode] = useState('');
  const [exportingFormat, setExportingFormat] = useState<'json' | 'csv' | null>(null);
  const [indexedCount, setIndexedCount] = useState<number | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>('free');
  const [itemLimit, setItemLimit] = useState<number | null>(null);
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
  const [requestedTier, setRequestedTier] = useState<SubscriptionTier | null>(null);
  const [loginSessions, setLoginSessions] = useState<
    Array<{
      id: string;
      login_at: string;
    }>
  >([]);
  const [loginSessionsLoading, setLoginSessionsLoading] = useState(false);
  const [loginSessionsPagination, setLoginSessionsPagination] = useState<{
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  } | null>(null);

  const loadTwoFactorStatus = useCallback(async () => {
    try {
      setTwoFactorLoading(true);
      const status = await apiClient.getTwoFactorStatus();
      setTwoFactorStatus(status);
      setTwoFactorError('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load two-factor status';
      setTwoFactorError(message);
    } finally {
      setTwoFactorLoading(false);
    }
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    try {
      const response = await apiClient.getCurrentUser();
      if (response.user) {
        auth.setUser(response.user);
        if (response.user.subscription_tier) {
          setSubscriptionTier(response.user.subscription_tier);
        } else if (response.user.is_premium) {
          setSubscriptionTier('pro');
        }
      }
    } catch (error) {
      console.error('Error refreshing current user:', error);
    }
  }, []);

  const loadIndexedCount = useCallback(async () => {
    try {
      const response = await apiClient.getIndexedItemCount();
      setIndexedCount(response.count);
      setItemLimit(typeof response.limit === 'number' ? response.limit : null);
      if (response.subscriptionTier) {
        setSubscriptionTier(response.subscriptionTier);
      } else {
        const user = auth.getUser();
        if (user?.subscription_tier) {
          setSubscriptionTier(user.subscription_tier);
        } else if (user?.is_premium) {
          setSubscriptionTier('pro');
        } else {
          setSubscriptionTier('free');
        }
      }
    } catch (error) {
      console.error('Error loading indexed count:', error);
    }
  }, []);

  const handleExportItems = async (format: 'json' | 'csv') => {
    try {
      setExportingFormat(format);
      await apiClient.downloadItemsExport(format);
      toast.success(`Export started in ${format.toUpperCase()} format`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to export items';
      toast.error(message);
    } finally {
      setExportingFormat(null);
    }
  };

  const handleSubscriptionComplete = useCallback(
    async (paymentIntentId: string) => {
      try {
        const verification = await apiClient.verifyPayment(paymentIntentId);
        if (verification.verified && verification.premium) {
          if (verification.subscriptionTier) {
            setSubscriptionTier(verification.subscriptionTier);
          }
          toast.success('Subscription upgraded! Downloads and API access unlocked.');
          await refreshCurrentUser();
          await loadIndexedCount();
        } else {
          toast.error(verification.message || 'Unable to verify payment');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to verify subscription payment';
        toast.error(message);
      } finally {
        setSubscriptionDialogOpen(false);
        setRequestedTier(null);
      }
    },
    [loadIndexedCount, refreshCurrentUser]
  );

  const handleSubscriptionCancel = useCallback(() => {
    setSubscriptionDialogOpen(false);
  }, []);

  const openSubscriptionDialog = useCallback(() => {
    setRequestedTier(null);
    setSubscriptionDialogOpen(true);
  }, []);

  const handleSubscriptionDialogChange = useCallback((open: boolean) => {
    setSubscriptionDialogOpen(open);
    if (!open) {
      setRequestedTier(null);
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

  const loadLoginSessions = useCallback(async () => {
    if (!authReady) {
      return;
    }

    try {
      setLoginSessionsLoading(true);
      const response = await apiClient.getLoginSessions(20, 0);
      setLoginSessions(response.sessions);
      setLoginSessionsPagination(response.pagination);
    } catch (error) {
      console.error('Failed to load login sessions:', error);
    } finally {
      setLoginSessionsLoading(false);
    }
  }, [authReady]);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    void loadTwoFactorStatus();
    void loadIndexedCount();
    void loadLoginSessions();
  }, [authReady, loadIndexedCount, loadTwoFactorStatus, loadLoginSessions]);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    const upgradeParam = searchParams?.get('upgrade');
    if (upgradeParam && ['plus', 'pro', 'pro_annual'].includes(upgradeParam)) {
      const normalizedTier = upgradeParam === 'plus' ? 'pro' : upgradeParam;
      const tier = normalizedTier as SubscriptionTier;
      setRequestedTier(tier);
      setSubscriptionDialogOpen(true);
    }

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('upgrade');
      window.history.replaceState(null, '', url.toString());
    }
  }, [authReady, searchParams]);

  const resetSetupState = () => {
    setTwoFactorSetup(null);
    setQrCodeDataUrl(null);
    setVerifyCode('');
  };

  const handleStartTwoFactorSetup = async () => {
    setActionLoading(true);
    setTwoFactorError('');
    setTwoFactorMessage('');
    setRecoveryCodes(null);
    setDisableMode(false);
    setDisableUseRecovery(false);
    setDisableCode('');
    setDisableRecoveryCode('');

    try {
      const setup = await apiClient.startTwoFactorSetup();
      setTwoFactorSetup(setup);
      setVerifyCode('');

      try {
        const dataUrl = await QRCode.toDataURL(setup.otpauthUrl);
        setQrCodeDataUrl(dataUrl);
      } catch (qrError) {
        console.error('Failed to generate 2FA QR code:', qrError);
        setQrCodeDataUrl(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start two-factor setup';
      setTwoFactorError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyTwoFactorSetup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!verifyCode.trim()) {
      setTwoFactorError('Enter the 6-digit code from your authenticator app.');
      return;
    }

    if (!twoFactorSetup) {
      setTwoFactorError('Two-factor setup has not been started.');
      return;
    }

    setActionLoading(true);
    setTwoFactorError('');

    try {
      const response = await apiClient.verifyTwoFactorSetup(verifyCode);
      resetSetupState();
      setRecoveryCodes(response.recoveryCodes);
      setTwoFactorMessage('Two-factor authentication is now enabled. Store your recovery codes in a secure place.');
      setTwoFactorStatus({
        enabled: true,
        confirmedAt: response.user.two_factor_confirmed_at ?? null,
        recoveryCodesRemaining: response.recoveryCodes.length,
      });
      auth.setUser(response.user);
      void loadTwoFactorStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to verify two-factor code';
      setTwoFactorError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSetup = () => {
    resetSetupState();
    setRecoveryCodes(null);
    setTwoFactorError('');
    setTwoFactorMessage('');
  };

  const handleCopyRecoveryCodes = async () => {
    if (!recoveryCodes || recoveryCodes.length === 0) {
      return;
    }

    try {
      await navigator.clipboard.writeText(recoveryCodes.join('\n'));
      setTwoFactorMessage('Recovery codes copied to clipboard.');
    } catch {
      setTwoFactorError('Failed to copy recovery codes. You can copy them manually.');
    }
  };

  const handleDisableTwoFactor = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (disableUseRecovery) {
      if (!disableRecoveryCode.trim()) {
        setTwoFactorError('Enter one of your recovery codes.');
        return;
      }
    } else if (!disableCode.trim()) {
      setTwoFactorError('Enter the 6-digit code from your authenticator app.');
      return;
    }

    setActionLoading(true);
    setTwoFactorError('');
    setTwoFactorMessage('');

    try {
      const response = await apiClient.disableTwoFactor({
        code: disableUseRecovery ? undefined : disableCode,
        recoveryCode: disableUseRecovery ? disableRecoveryCode : undefined,
      });
      setTwoFactorMessage('Two-factor authentication has been disabled.');
      setTwoFactorStatus({
        enabled: false,
        confirmedAt: null,
        recoveryCodesRemaining: 0,
      });
      setRecoveryCodes(null);
      resetSetupState();
      setDisableMode(false);
      setDisableUseRecovery(false);
      setDisableCode('');
      setDisableRecoveryCode('');
      auth.setUser(response.user);
      void loadTwoFactorStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to disable two-factor authentication';
      setTwoFactorError(message);
    } finally {
      setActionLoading(false);
    }
  };

  if (authLoading) {
    return <div className="container mx-auto px-4 py-12">Loading...</div>;
  }

  if (!auth.isAuthenticated()) {
    return null;
  }

  const currentUser = auth.getUser();
  const twoFactorConfirmedAt = twoFactorStatus?.confirmedAt
    ? new Date(twoFactorStatus.confirmedAt).toLocaleString()
    : null;
  const effectiveSubscriptionTier: SubscriptionTier =
    currentUser?.subscription_tier ?? (currentUser?.is_premium ? 'pro' : subscriptionTier);
  const isSubscriber = Boolean(
    currentUser?.is_premium || (effectiveSubscriptionTier && effectiveSubscriptionTier !== 'free')
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <AnnouncementBanner />
      <header className="bg-white border-b">
        <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 flex justify-between items-center max-w-full">
          <h1 className="text-xl sm:text-2xl font-bold">Settings</h1>
          <div className="flex items-center gap-2 sm:gap-4">
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
            <CardTitle>Two-Factor Authentication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {twoFactorError && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {twoFactorError}
              </div>
            )}

            {twoFactorMessage && (
              <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                {twoFactorMessage}
              </div>
            )}

            {twoFactorLoading ? (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {twoFactorSetup ? (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Scan the QR code with your authenticator app and enter the 6-digit code to enable two-factor authentication.
                    </p>

                    {qrCodeDataUrl ? (
                      <div className="flex justify-center">
                        <img
                          src={qrCodeDataUrl}
                          alt="Two-factor authentication QR code"
                          className="h-40 w-40 rounded-lg border border-gray-200 bg-white p-2 shadow-xs"
                        />
                      </div>
                    ) : (
                      <div className="rounded border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                        QR code unavailable. Use the secret key below in your authenticator app.
                      </div>
                    )}

                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Secret key</p>
                      <code className="block rounded bg-gray-900 px-3 py-2 text-sm text-green-200">
                        {twoFactorSetup.secret}
                      </code>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">OTP URL</p>
                      <div className="rounded bg-gray-100 px-3 py-2 text-xs text-gray-700 wrap-break-word">
                        {twoFactorSetup.otpauthUrl}
                      </div>
                    </div>

                    <form className="space-y-3" onSubmit={handleVerifyTwoFactorSetup}>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Authenticator code</label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="123456"
                          value={verifyCode}
                          onChange={(event) => setVerifyCode(event.target.value)}
                          maxLength={6}
                          autoFocus
                        />
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Button type="submit" disabled={actionLoading}>
                          {actionLoading ? 'Verifying...' : 'Verify and enable'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleCancelSetup}
                          disabled={actionLoading}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <>
                    {twoFactorStatus?.enabled ? (
                      <div className="space-y-4">
                        <div className="space-y-2 text-sm text-gray-600">
                          <p>
                            Two-factor authentication is currently <span className="font-semibold text-green-600">enabled</span>.
                          </p>
                          {twoFactorConfirmedAt && (
                            <p>Enabled on {twoFactorConfirmedAt}</p>
                          )}
                          <p>
                            Recovery codes remaining: {twoFactorStatus.recoveryCodesRemaining}
                          </p>
                        </div>

                        {!disableMode ? (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setDisableMode(true);
                              setDisableCode('');
                              setDisableRecoveryCode('');
                              setDisableUseRecovery(false);
                              setTwoFactorError('');
                              setTwoFactorMessage('');
                            }}
                          >
                            Disable two-factor authentication
                          </Button>
                        ) : (
                          <form className="space-y-3" onSubmit={handleDisableTwoFactor}>
                            {!disableUseRecovery ? (
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Authenticator code</label>
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  placeholder="123456"
                                  value={disableCode}
                                  onChange={(event) => setDisableCode(event.target.value)}
                                  maxLength={6}
                                  autoFocus
                                />
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Recovery code</label>
                                <Input
                                  type="text"
                                  placeholder="XXXX-XXXX"
                                  value={disableRecoveryCode}
                                  onChange={(event) => setDisableRecoveryCode(event.target.value)}
                                  autoFocus
                                />
                              </div>
                            )}

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-start">
                              <Button type="submit" variant="destructive" disabled={actionLoading}>
                                {actionLoading ? 'Disabling...' : 'Disable'}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                  setDisableMode(false);
                                  setDisableCode('');
                                  setDisableRecoveryCode('');
                                  setDisableUseRecovery(false);
                                }}
                                disabled={actionLoading}
                              >
                                Cancel
                              </Button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDisableUseRecovery((value) => !value);
                                  setDisableCode('');
                                  setDisableRecoveryCode('');
                                  setTwoFactorError('');
                                }}
                                className="text-sm text-blue-600 hover:text-blue-700"
                              >
                                {disableUseRecovery ? 'Use authenticator code' : 'Use a recovery code'}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-gray-600">
                          Add an extra layer of security by requiring a code from your authenticator app when you sign in.
                        </p>
                        <Button onClick={handleStartTwoFactorSetup} disabled={actionLoading}>
                          {actionLoading ? 'Preparing...' : 'Set up two-factor authentication'}
                        </Button>
                      </div>
                    )}

                    {recoveryCodes && (
                      <div className="space-y-3 rounded border border-blue-200 bg-blue-50 px-4 py-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-blue-900">Recovery codes</p>
                          <p className="text-xs text-blue-800">
                            Save these codes in a secure location. Each code can be used once if you lose access to your authenticator app.
                          </p>
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {recoveryCodes.map((code) => (
                            <code
                              key={code}
                              className="rounded bg-white px-3 py-2 text-sm font-semibold tracking-wide text-blue-900 shadow-xs"
                            >
                              {code}
                            </code>
                          ))}
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleCopyRecoveryCodes}
                          >
                            Copy codes
                          </Button>
                          <span className="text-xs text-blue-800">
                            These codes are shown only once. Store them safely.
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
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

        <Card>
          <CardHeader>
            <CardTitle>Downloads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isSubscriber ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Export all enriched items as structured data. Hosted attachments are not included.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => handleExportItems('json')}
                    disabled={exportingFormat !== null}
                  >
                    {exportingFormat === 'json' ? 'Preparing JSON...' : 'Download JSON'}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => handleExportItems('csv')}
                    disabled={exportingFormat !== null}
                  >
                    {exportingFormat === 'csv' ? 'Preparing CSV...' : 'Download CSV'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Unlock JSON and CSV exports when you upgrade your plan. Paid tiers also include higher item limits.
                </p>
                <Button onClick={openSubscriptionDialog} className="w-full sm:w-auto">
                  Upgrade to unlock exports
                </Button>
                <p className="text-xs text-muted-foreground">
                  Starting at $5/month with priority processing and API access.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Slack Integration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SlackIntegrationSection />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Referrals</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Earn 20% commission on subscription payments from users you refer (based on their discounted price). Referred users get a 10% discount. Create a referral code and start sharing!
            </p>
            <Button
              onClick={() => router.push('/referrals')}
              variant="outline"
            >
              Go to Referrals Dashboard
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Login History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loginSessionsLoading ? (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : loginSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No login history available.</p>
            ) : (
              <div className="space-y-2">
                {loginSessions.map((session) => {
                  const loginDate = new Date(session.login_at);
                  const dateStr = loginDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  });
                  const timeStr = loginDate.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  });
                  return (
                    <div key={session.id} className="text-sm text-gray-600 py-2 border-b border-gray-100 last:border-b-0">
                      Logged in on {dateStr} at {timeStr}
                    </div>
                  );
                })}
                {loginSessionsPagination && loginSessionsPagination.total > loginSessions.length && (
                  <p className="text-xs text-muted-foreground pt-2">
                    Showing {loginSessions.length} of {loginSessionsPagination.total} logins
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

      </main>

      <SubscriptionPaymentDialog
        open={subscriptionDialogOpen}
        onOpenChange={handleSubscriptionDialogChange}
        onPaymentComplete={handleSubscriptionComplete}
        onCancel={handleSubscriptionCancel}
        currentTier={effectiveSubscriptionTier}
        currentLimit={itemLimit}
        currentCount={indexedCount}
        initialTier={requestedTier ?? undefined}
      />

    </div>
  );
}

function SlackIntegrationSection() {
  const [slackStatus, setSlackStatus] = useState<{
    connected: boolean;
    workspaceId: string | null;
    workspaceName: string | null;
  } | null>(null);
  const [slackLoading, setSlackLoading] = useState(true);
  const [slackConnecting, setSlackConnecting] = useState(false);
  const [ingesting, setIngesting] = useState(false);

  const loadSlackStatus = useCallback(async () => {
    try {
      setSlackLoading(true);
      const status = await apiClient.getSlackStatus();
      setSlackStatus(status);
    } catch (error) {
      console.error('Error loading Slack status:', error);
      setSlackStatus({ connected: false, workspaceId: null, workspaceName: null });
    } finally {
      setSlackLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSlackStatus();
  }, [loadSlackStatus]);

  const handleConnectSlack = async () => {
    try {
      setSlackConnecting(true);
      const { authUrl } = await apiClient.initiateSlackOAuth();
      window.location.href = authUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to initiate Slack connection';
      toast.error(message);
      setSlackConnecting(false);
    }
  };

  const handleDisconnectSlack = async () => {
    if (!confirm('Are you sure you want to disconnect your Slack workspace?')) {
      return;
    }

    try {
      await apiClient.disconnectSlack();
      toast.success('Slack workspace disconnected');
      await loadSlackStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to disconnect Slack';
      toast.error(message);
    }
  };

  const handleIngestWorkspace = async () => {
    if (!slackStatus?.workspaceId) {
      return;
    }

    try {
      setIngesting(true);
      await apiClient.ingestSlackWorkspace(slackStatus.workspaceId);
      toast.success('Slack workspace ingestion started. This may take a few minutes.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start ingestion';
      toast.error(message);
    } finally {
      setIngesting(false);
    }
  };

  if (slackLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {slackStatus?.connected ? (
        <div className="space-y-3">
          <div className="text-sm text-gray-600">
            <p>
              Connected to workspace: <span className="font-semibold">{slackStatus.workspaceName || 'Unknown'}</span>
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={handleIngestWorkspace} disabled={ingesting}>
              {ingesting ? 'Ingesting...' : 'Sync Messages'}
            </Button>
            <Button variant="outline" onClick={handleDisconnectSlack}>
              Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Connect your Slack workspace to search messages, create summaries, and extract actions.
          </p>
          <Button onClick={handleConnectSlack} disabled={slackConnecting}>
            {slackConnecting ? 'Connecting...' : 'Connect Slack Workspace'}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-12">
          Loading settings...
        </div>
      }
    >
      <SettingsPageContent />
    </Suspense>
  );
}
