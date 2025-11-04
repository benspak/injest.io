'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useState } from 'react';

export default function Home() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      await fetch(`${API_URL}/auth/magic-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      alert('Magic link sent! Check your email.');
    } catch (error) {
      alert('Failed to send magic link');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = () => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    window.location.href = `${API_URL}/auth/google`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Injest.io</CardTitle>
          <CardDescription>Your personal knowledge recall system</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleMagicLink} className="space-y-4">
            <div>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border rounded-md"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Sending...' : 'Sign in with Magic Link'}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <Button onClick={handleGoogleAuth} variant="outline" className="w-full">
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
