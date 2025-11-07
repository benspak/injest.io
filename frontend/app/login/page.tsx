'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';

// Get API URL (same logic as api.ts)
function getApiUrl(): string {
  let url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5555';

  // Remove trailing slashes
  url = url.trim().replace(/\/+$/, '');

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return typeof window !== 'undefined' && window.location.protocol === 'https:'
      ? `https://${url}`
      : `http://${url}`;
  }
  return url;
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [xcomLoading, setXcomLoading] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const error = searchParams.get('error');

  // Handle token verification
  useEffect(() => {
    if (token) {
      setLoading(true);
      auth.verify(token)
        .then(() => {
          router.push('/dashboard');
        })
        .catch(() => {
          setMessage('Invalid or expired token');
          setLoading(false);
        });
    }
  }, [token, router]);

  // Handle error from OAuth callback
  useEffect(() => {
    if (error) {
      setMessage(`Login failed: ${decodeURIComponent(error)}`);
    }
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      await auth.login(email);
      setMessage('Magic link sent! Check your email.');
    } catch (error: any) {
      setMessage(error.message || 'Failed to send magic link');
    } finally {
      setLoading(false);
    }
  };

  const handleXComLogin = async () => {
    setXcomLoading(true);
    setMessage('');
    try {
      // Redirect to backend X.com login endpoint
      const apiUrl = getApiUrl();
      window.location.href = `${apiUrl}/api/auth/xcom/login`;
    } catch (error: any) {
      setMessage(error.message || 'Failed to initiate X.com login');
      setXcomLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 overflow-x-hidden px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in to Injest.io</CardTitle>
          <CardDescription>
            Enter your email to receive a magic link
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" disabled={loading || xcomLoading}>
              {loading ? 'Sending...' : 'Send Magic Link'}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleXComLogin}
              disabled={loading || xcomLoading}
            >
              {xcomLoading ? 'Connecting...' : 'Continue with X.com'}
            </Button>

            {message && (
              <p className={`text-sm ${message.includes('sent') || message.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                {message}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
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
      <LoginForm />
    </Suspense>
  );
}
