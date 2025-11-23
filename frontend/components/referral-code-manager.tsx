'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

export function ReferralCodeManager() {
  const [code, setCode] = useState('');
  const [currentCode, setCurrentCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetchCode();
  }, []);

  const fetchCode = async () => {
    try {
      const response = await apiClient.getReferralCode();
      setCurrentCode(response.referral_code);
    } catch (error) {
      console.error('Error fetching referral code:', error);
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast.error('Please enter a referral code');
      return;
    }

    setLoading(true);
    try {
      await apiClient.setReferralCode(code.trim());
      setCurrentCode(code.trim());
      setCode('');
      toast.success('Referral code set successfully!');
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Failed to set referral code';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Referral Code</CardTitle>
        <CardDescription>
          Create a unique referral code to share with others. You'll earn 20% commission on all subscription payments from users you refer (based on their discounted price), and they'll get a 10% discount.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {currentCode ? (
          <div className="space-y-4">
            <div>
              <Label>Current Referral Code</Label>
              <div className="mt-2 p-3 bg-gray-100 rounded-md font-mono text-lg">
                {currentCode}
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Your referral code is active. Share it with others to start earning commissions!
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="referral-code">Referral Code</Label>
              <Input
                id="referral-code"
                type="text"
                placeholder="e.g., BENJAMIN"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={20}
                pattern="[a-zA-Z0-9-]+"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                3-20 characters, letters, numbers, and hyphens only. Must be unique.
              </p>
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Setting...' : 'Set Referral Code'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
