'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { ReferralCodeManager } from './referral-code-manager';
import { ReferralLinkGenerator } from './referral-link-generator';
import { StripeConnectSetup } from './stripe-connect-setup';

export function ReferralDashboard() {
  const [stats, setStats] = useState<{
    referral_code: string | null;
    total_referrals: number;
    total_earnings_cents: number;
    pending_earnings_cents: number;
    has_connected_account: boolean;
  } | null>(null);
  const [commissions, setCommissions] = useState<Array<{
    id: string;
    amount_cents: number;
    status: 'pending' | 'paid' | 'failed';
    created_at: string;
    paid_at: string | null;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsResponse, commissionsResponse] = await Promise.all([
        apiClient.getReferralStats(),
        apiClient.getReferralCommissions(10, 0),
      ]);
      setStats(statsResponse);
      setCommissions(commissionsResponse.commissions);
    } catch (error) {
      console.error('Error fetching referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'text-green-600';
      case 'pending':
        return 'text-yellow-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Referral Program</h1>
        <p className="text-gray-600 mt-2">
          Earn 20% commission on all subscription payments from users you refer.
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Total Referrals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total_referrals}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Total Earnings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {formatCurrency(stats.total_earnings_cents)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pending Earnings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">
                {formatCurrency(stats.pending_earnings_cents)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Referral Code Manager */}
      <ReferralCodeManager />

      {/* Referral Link Generator */}
      <ReferralLinkGenerator />

      {/* Stripe Connect Setup */}
      <StripeConnectSetup />

      {/* Recent Commissions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Commissions</CardTitle>
          <CardDescription>
            Your recent commission payments from referrals.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {commissions.length === 0 ? (
            <p className="text-gray-500">No commissions yet. Start referring users to earn!</p>
          ) : (
            <div className="space-y-4">
              {commissions.map((commission) => (
                <div
                  key={commission.id}
                  className="flex justify-between items-center p-4 border rounded-lg"
                >
                  <div>
                    <div className="font-medium">{formatCurrency(commission.amount_cents)}</div>
                    <div className="text-sm text-gray-500">
                      {formatDate(commission.created_at)}
                    </div>
                  </div>
                  <div className={`font-medium ${getStatusColor(commission.status)}`}>
                    {commission.status.charAt(0).toUpperCase() + commission.status.slice(1)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
