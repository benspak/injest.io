'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

export function StripeConnectSetup() {
  const [status, setStatus] = useState<{
    has_account: boolean;
    details_submitted?: boolean;
    charges_enabled?: boolean;
    payouts_enabled?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingUp, setSettingUp] = useState(false);
  const [platformOnboardingRequired, setPlatformOnboardingRequired] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await apiClient.getStripeConnectStatus();
      setStatus(response);
      setPlatformOnboardingRequired(false);
    } catch (error: any) {
      console.error('Error fetching Connect status:', error);
      // Check if this is a platform onboarding error
      if (error.data?.requires_platform_onboarding) {
        setPlatformOnboardingRequired(true);
      } else {
        toast.error('Failed to load payment account status');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async () => {
    setSettingUp(true);
    try {
      const response = await apiClient.setupStripeConnect();
      // Redirect to Stripe onboarding
      window.location.href = response.onboarding_url;
    } catch (error: any) {
      // Check if this is a platform onboarding error
      if (error.data?.requires_platform_onboarding) {
        toast.error(
          'Stripe Connect must be enabled for your platform first. ' +
          'Please complete the platform onboarding in your Stripe Dashboard.',
          {
            duration: 10000,
            action: {
              label: 'Open Dashboard',
              onClick: () => window.open(error.data.platform_onboarding_url, '_blank'),
            },
          }
        );
      } else {
        const message = error instanceof Error ? error.message : 'Failed to setup payment account';
        toast.error(message);
      }
      setSettingUp(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (platformOnboardingRequired) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Platform Setup Required</CardTitle>
          <CardDescription>
            Stripe Connect must be enabled for your platform before users can receive payments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <p className="text-sm text-yellow-800">
              To enable the affiliate program, you need to complete the Stripe Connect platform onboarding.
              This is a one-time setup that allows your platform to create connected accounts for affiliates.
            </p>
          </div>
          <Button
            onClick={() => window.open('https://dashboard.stripe.com/settings/connect/platform-profile', '_blank')}
            className="w-full"
          >
            Complete Platform Onboarding
          </Button>
          <p className="text-xs text-gray-500">
            After completing the onboarding, refresh this page to continue setting up affiliate payments.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!status?.has_account) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Account Setup</CardTitle>
          <CardDescription>
            Connect your Stripe account to receive commission payments. You'll need to provide some basic information to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleSetup} disabled={settingUp}>
            {settingUp ? 'Setting up...' : 'Connect Stripe Account'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!status.details_submitted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Complete Payment Account Setup</CardTitle>
          <CardDescription>
            Finish setting up your payment account to receive commissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleSetup} disabled={settingUp}>
            {settingUp ? 'Loading...' : 'Complete Setup'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Account</CardTitle>
        <CardDescription>
          Your Stripe account is connected and ready to receive payments.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Account Status:</span>
            <span className="text-sm font-medium text-green-600">Active</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Payouts Enabled:</span>
            <span className="text-sm font-medium">
              {status.payouts_enabled ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
