'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api';
import { auth } from '@/lib/auth';

function XComLinkForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkId = searchParams.get('linkId');
  const username = searchParams.get('username');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!linkId) {
      toast.error('Invalid link. Please try logging in with X.com again.');
      router.push('/login');
    }
  }, [linkId, router]);

  const handleLinkToExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkId || !email) return;

    setLoading(true);
    try {
      await apiClient.linkXComAccount(linkId, email);
      setSubmitted(true);
      toast.success('Verification email sent! Please check your email to complete linking.');
    } catch (error: any) {
      console.error('Error linking X.com account:', error);
      toast.error(error.message || 'Failed to link X.com account');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewAccount = async () => {
    if (!linkId) return;

    setLoading(true);
    try {
      const response = await apiClient.createAccountWithXCom(linkId);
      if (response.token) {
        apiClient.setToken(response.token);
        // Get user info to set in auth
        const userResponse = await apiClient.getCurrentUser();
        if (userResponse.user) {
          auth.setUser(userResponse.user);
        }
        toast.success('Account created! Redirecting to dashboard...');
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);
      }
    } catch (error: any) {
      console.error('Error creating account:', error);
      toast.error(error.message || 'Failed to create account');
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Check Your Email</CardTitle>
            <CardDescription>
              We've sent a verification link to {email}. Click the link in the email to complete linking your X.com account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => router.push('/login')}
              variant="outline"
              className="w-full"
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Link X.com Account</CardTitle>
          <CardDescription>
            You've successfully logged in with X.com as <strong>@{username}</strong>.
            {linkId && ' Would you like to link this account to an existing email address?'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleLinkToExisting} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Link to Existing Account (Email)</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Enter the email address associated with your existing account. We'll send a verification link to confirm.
              </p>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !email}
            >
              {loading ? 'Sending...' : 'Link to Existing Account'}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <Button
            onClick={handleCreateNewAccount}
            variant="outline"
            className="w-full"
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create New Account Instead'}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            This will create a new account using your X.com username. You can add an email address later.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function XComLinkPage() {
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
      <XComLinkForm />
    </Suspense>
  );
}
