'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';
import { apiClient } from '@/lib/api';

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingUser, setPendingUser] = useState(auth.getPendingTwoFactorUser());

  useEffect(() => {
    // Check if we have a pending 2FA challenge
    if (!auth.hasPendingTwoFactor()) {
      // No pending 2FA, redirect to login
      router.push('/login');
      return;
    }

    const user = auth.getPendingTwoFactorUser();
    setPendingUser(user);
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!auth.hasPendingTwoFactor()) {
      setError('No pending two-factor challenge');
      setLoading(false);
      return;
    }

    const pendingTwoFactor = auth.getPendingTwoFactorUser();
    if (!pendingTwoFactor) {
      setError('No pending two-factor challenge');
      setLoading(false);
      return;
    }

    try {
      const pendingToken = auth.getPendingTwoFactorToken();
      if (!pendingToken) {
        setError('No pending two-factor challenge. Please sign in again.');
        router.push('/login');
        return;
      }

      const response = await apiClient.completeTwoFactorChallenge({
        pendingToken,
        code: useRecoveryCode ? undefined : code,
        recoveryCode: useRecoveryCode ? recoveryCode : undefined,
      });

      // Success - clear pending 2FA and redirect to dashboard
      auth.clearPendingTwoFactor();
      auth.setUser(response.user);
      router.push('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to verify two-factor code';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!pendingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">Loading...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!useRecoveryCode ? (
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  required={!useRecoveryCode}
                  autoFocus
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="recovery-code">Recovery Code</Label>
                <Input
                  id="recovery-code"
                  type="text"
                  placeholder="Enter recovery code"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                  required={useRecoveryCode}
                  autoFocus
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setUseRecoveryCode(!useRecoveryCode);
                  setCode('');
                  setRecoveryCode('');
                  setError('');
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {useRecoveryCode ? 'Use verification code' : 'Use recovery code instead'}
              </button>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify'}
            </Button>

            {error && (
              <p className="text-sm text-red-600 text-center">{error}</p>
            )}

            <p className="text-xs text-gray-500 text-center">
              Don't have access to your authenticator? Use a recovery code.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">Loading...</div>
          </CardContent>
        </Card>
      </div>
    }>
      <VerifyForm />
    </Suspense>
  );
}
