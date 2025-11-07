'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function XComVerifyLinkForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Verifying and linking your X.com account...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided');
      return;
    }

    // The verification is handled server-side via redirect
    // This page just shows loading state while redirect happens
    // The server will redirect to dashboard with success message
    setStatus('verifying');
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Linking X.com Account</CardTitle>
          <CardDescription>
            {status === 'verifying' && 'Please wait while we link your X.com account...'}
            {status === 'success' && 'Account linked successfully!'}
            {status === 'error' && 'Linking failed'}
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
              <Button
                onClick={() => router.push('/login')}
                className="w-full"
                variant="outline"
              >
                Go to Login
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function XComVerifyLinkPage() {
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
      <XComVerifyLinkForm />
    </Suspense>
  );
}
