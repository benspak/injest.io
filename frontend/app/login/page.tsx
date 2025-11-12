'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';
import { SUBSCRIPTION_PLANS, type SubscriptionTier } from '@/lib/subscriptionPlans';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const error = searchParams.get('error');
  const planParam = searchParams.get('plan');
  const plan: SubscriptionTier | null =
    planParam && ['free', 'plus', 'power', 'pro'].includes(planParam)
      ? (planParam as SubscriptionTier)
      : null;

  // Handle token verification
  useEffect(() => {
    if (token) {
      setLoading(true);
      setMessage('Redirecting to verification...');
      router.replace(`/auth/verify?token=${encodeURIComponent(token)}`);
    }
  }, [token, router]);

  // Handle error from OAuth callback
  useEffect(() => {
    if (error) {
      setMessage(`Login failed: ${decodeURIComponent(error)}`);
    }
  }, [error]);

  useEffect(() => {
    if (plan) {
      sessionStorage.setItem('checkoutPlan', plan);
    }
  }, [plan]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      await auth.login(email);
      setMessage('Magic link sent! Check your email.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to send magic link';
      setMessage(message);
    } finally {
      setLoading(false);
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
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Sending...' : 'Send Magic Link'}
            </Button>

            {message && (
              <p className={`text-sm ${message.includes('sent') || message.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                {message}
              </p>
            )}

            {plan && (
              <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                You selected the <span className="font-semibold">{SUBSCRIPTION_PLANS[plan].name}</span>{' '}
                plan. After verifying your email, we&apos;ll reopen checkout to finish upgrading.
              </div>
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
