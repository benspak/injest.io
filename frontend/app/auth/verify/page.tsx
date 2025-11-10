'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type VerifyStatus = 'verifying' | 'twoFactor' | 'success' | 'error';

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<VerifyStatus>('verifying');
  const [message, setMessage] = useState('Verifying your email...');
  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pendingUser = auth.getPendingTwoFactorUser();

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided');
      return;
    }

    setStatus('verifying');
    setMessage('Verifying your email...');

    auth.verify(token)
      .then((result) => {
        if (result.twoFactorRequired) {
          setStatus('twoFactor');
          setMessage('Two-factor authentication required');
        } else {
          setStatus('success');
          setMessage('Email verified! Redirecting to dashboard...');
          setTimeout(() => {
            router.push('/dashboard');
          }, 2000);
        }
      })
      .catch((error: unknown) => {
        const err = error as { message?: string };
        setStatus('error');
        setMessage(err?.message || 'Invalid or expired token');
      });
  }, [token, router]);

  const handleTwoFactorSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTwoFactorError('');

    if (!auth.hasPendingTwoFactor()) {
      setStatus('error');
      setMessage('Two-factor challenge expired. Please request a new magic link.');
      return;
    }

    if (!useRecoveryCode && code.trim().length === 0) {
      setTwoFactorError('Enter the 6-digit code from your authenticator app.');
      return;
    }

    if (useRecoveryCode && recoveryCode.trim().length === 0) {
      setTwoFactorError('Enter one of your recovery codes.');
      return;
    }

    setSubmitting(true);
    try {
      await auth.completeTwoFactorChallenge({
        code: useRecoveryCode ? undefined : code,
        recoveryCode: useRecoveryCode ? recoveryCode : undefined,
      });
      setStatus('success');
      setMessage('Two-factor verification successful! Redirecting to dashboard...');
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (error) {
      const apiError = error as { message?: string };
      setTwoFactorError(apiError?.message || 'Verification failed. Check your code and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    auth.clearPendingTwoFactor();
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {status === 'twoFactor' ? 'Two-Factor Verification' : 'Email Verification'}
          </CardTitle>
          <CardDescription>
            {status === 'verifying' && 'Please wait while we verify your email...'}
            {status === 'twoFactor' && 'Enter your authentication code to finish signing in.'}
            {status === 'success' && 'Verification successful!'}
            {status === 'error' && 'Verification failed'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {status === 'verifying' && (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}

            {status !== 'twoFactor' && (
              <p
                className={`text-sm text-center ${
                  status === 'success'
                    ? 'text-green-600'
                    : status === 'error'
                      ? 'text-red-600'
                      : 'text-gray-600'
                }`}
              >
                {message}
              </p>
            )}

            {status === 'twoFactor' && (
              <div className="space-y-4">
                {pendingUser?.email && (
                  <p className="text-sm text-center text-gray-600">
                    Verification for <span className="font-medium">{pendingUser.email}</span>
                  </p>
                )}

                <form className="space-y-4" onSubmit={handleTwoFactorSubmit}>
                  {!useRecoveryCode ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Authenticator code
                      </label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="123456"
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                        maxLength={6}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Recovery code
                      </label>
                      <Input
                        type="text"
                        placeholder="XXXX-XXXX"
                        value={recoveryCode}
                        onChange={(event) => setRecoveryCode(event.target.value)}
                        autoFocus
                      />
                    </div>
                  )}

                  {twoFactorError && (
                    <p className="text-sm text-red-600">{twoFactorError}</p>
                  )}

                  <div className="space-y-2">
                    <Button type="submit" className="w-full" disabled={submitting}>
                      {submitting ? 'Verifying...' : 'Verify'}
                    </Button>
                    <button
                      type="button"
                      onClick={() => {
                        setTwoFactorError('');
                        setUseRecoveryCode((value) => !value);
                        setCode('');
                        setRecoveryCode('');
                      }}
                      className="w-full text-sm text-blue-600 hover:text-blue-700"
                    >
                      {useRecoveryCode ? 'Use authenticator code instead' : 'Use a recovery code'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="w-full text-sm text-gray-500 hover:text-gray-600"
                    >
                      Cancel and return to login
                    </button>
                  </div>
                </form>
              </div>
            )}

            {status === 'error' && (
              <button
                onClick={() => router.push('/login')}
                className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Go to Login
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <div className="text-center">Loading...</div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <VerifyForm />
    </Suspense>
  );
}
