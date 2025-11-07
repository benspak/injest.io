'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const xcomLinked = searchParams.get('xcom_linked');
  const username = searchParams.get('username');
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided');
      return;
    }

    auth.verify(token)
      .then(() => {
        setStatus('success');
        if (xcomLinked === 'true') {
          setMessage(`X.com account linked successfully! Redirecting to dashboard...`);
        } else {
          setMessage('Email verified! Redirecting to dashboard...');
        }
        const redirectUrl = xcomLinked === 'true' && username
          ? `/dashboard?xcom_linked=true&username=${encodeURIComponent(username)}`
          : '/dashboard';
        setTimeout(() => {
          router.push(redirectUrl);
        }, 2000);
      })
      .catch((error: unknown) => {
        const err = error as { message?: string };
        setStatus('error');
        setMessage(err?.message || 'Invalid or expired token');
      });
  }, [token, router, xcomLinked, username]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {xcomLinked === 'true' ? 'Linking X.com Account' : 'Email Verification'}
          </CardTitle>
          <CardDescription>
            {status === 'verifying' && (xcomLinked === 'true' ? 'Please wait while we link your X.com account...' : 'Please wait while we verify your email...')}
            {status === 'success' && (xcomLinked === 'true' ? 'Account linked successfully!' : 'Verification successful!')}
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
            <p className={`text-sm text-center ${
              status === 'success' ? 'text-green-600' :
              status === 'error' ? 'text-red-600' :
              'text-gray-600'
            }`}>
              {message}
            </p>
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
