'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

export function ReferralLinkGenerator() {
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralLink, setReferralLink] = useState('');

  useEffect(() => {
    fetchCode();
  }, []);

  useEffect(() => {
    if (referralCode) {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      setReferralLink(`${baseUrl}/login?ref=${referralCode}`);
    }
  }, [referralCode]);

  const fetchCode = async () => {
    try {
      const response = await apiClient.getReferralCode();
      setReferralCode(response.referral_code);
    } catch (error) {
      console.error('Error fetching referral code:', error);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success('Referral link copied to clipboard!');
  };

  if (!referralCode) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Referral Link</CardTitle>
          <CardDescription>
            Create a referral code first to generate your referral link.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Referral Link</CardTitle>
        <CardDescription>
          Share this link with others. When they sign up and subscribe, you'll earn 20% commission on their discounted payments and they'll get a 10% discount.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Referral Link</Label>
          <div className="flex gap-2 mt-2">
            <Input
              type="text"
              value={referralLink}
              readOnly
              className="font-mono text-sm"
            />
            <Button onClick={copyToClipboard} variant="outline">
              Copy
            </Button>
          </div>
        </div>
        <div className="text-sm text-gray-600">
          <p>Share this link on social media, in emails, or anywhere else!</p>
          <p className="mt-2">
            <strong>Your code:</strong> <span className="font-mono">{referralCode}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
