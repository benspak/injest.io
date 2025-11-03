'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleMagicLink = async () => {
    if (!email) return;
    setLoading(true);
    try {
      await api.magicLink(email);
      alert('Check your email for the magic link!');
    } catch (error) {
      console.error('Magic link failed:', error);
      alert('Failed to send magic link');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    // In production, integrate with Google OAuth
    alert('Google OAuth integration needed');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Brain className="h-12 w-12" />
          </div>
          <CardTitle className="text-3xl">Brain AI</CardTitle>
          <CardDescription>Your second brain</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleMagicLink()}
            />
          </div>
          <Button
            className="w-full"
            onClick={handleMagicLink}
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Send Magic Link'}
          </Button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleAuth}
          >
            Continue with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
