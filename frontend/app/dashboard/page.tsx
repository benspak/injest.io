'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Inbox, Send, Users, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { AnnouncementBanner } from '@/components/announcement-banner';
import { AvatarMenu } from '@/components/avatar-menu';
import { FeedbackDialog } from '@/components/feedback-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { auth } from '@/lib/auth';
import { SUBSCRIPTION_PLANS } from '@/lib/subscriptionPlans';

interface DashboardStats {
  itemCount: number | null;
  itemLimit: number;
  contactCount: number | null;
  subscriptionTier?: string;
  planName?: string;
  isAtLimit: boolean;
  isApproachingLimit: boolean;
}

export default function DashboardPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    itemCount: null,
    itemLimit: 0,
    contactCount: null,
    isAtLimit: false,
    isApproachingLimit: false,
  });
  const currentUser = auth.getUser();

  useEffect(() => {
    const init = async () => {
      await auth.restore();
      setAuthLoading(false);

      if (!auth.isAuthenticated()) {
        router.push('/login');
        return;
      }

      // Load stats
      setLoading(true);
      try {
        // Get item count and usage info
        const itemCountResponse = await apiClient.getIndexedItemCount();
        const contactCountResponse = await apiClient.getContactCount();

        setStats({
          itemCount: itemCountResponse.count,
          itemLimit: itemCountResponse.limit,
          contactCount: contactCountResponse.count,
          subscriptionTier: itemCountResponse.subscriptionTier,
          planName: itemCountResponse.planName,
          isAtLimit: itemCountResponse.isAtLimit,
          isApproachingLimit: itemCountResponse.isApproachingLimit,
        });
      } catch (error) {
        console.error('Failed to load dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [router]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AnnouncementBanner />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  const subscriptionTier = stats.subscriptionTier || currentUser?.subscription_tier || 'free';
  const plan = SUBSCRIPTION_PLANS[subscriptionTier as keyof typeof SUBSCRIPTION_PLANS] || SUBSCRIPTION_PLANS.free;
  const usagePercentage = stats.itemLimit > 0 ? (stats.itemCount || 0) / stats.itemLimit : 0;
  const remainingItems = Math.max(0, stats.itemLimit - (stats.itemCount || 0));

  return (
    <div className="min-h-screen bg-gray-50">
      <AnnouncementBanner />
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <div className="flex items-center gap-4">
            <FeedbackDialog
              userEmail={currentUser?.email}
              buttonVariant="outline"
              buttonSize="sm"
            />
            <AvatarMenu user={currentUser} />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-8 max-w-7xl">
        <div className="space-y-6">
          {/* Quick Links Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Links</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {/* Inbox Card */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Inbox className="h-5 w-5 text-blue-600" />
                      </div>
                      <CardTitle className="text-lg">Inbox</CardTitle>
                    </div>
                  </div>
                  <CardDescription>View and manage your items</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-3xl font-bold text-gray-900">
                        {stats.itemCount !== null ? stats.itemCount.toLocaleString() : '—'}
                      </p>
                      <p className="text-sm text-gray-500">Items indexed</p>
                    </div>
                    <Link href="/inbox">
                      <Button className="w-full" variant="outline">
                        Go to Inbox
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* Send Card */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-50 rounded-lg">
                        <Send className="h-5 w-5 text-green-600" />
                      </div>
                      <CardTitle className="text-lg">Send</CardTitle>
                    </div>
                  </div>
                  <CardDescription>Generate and send outreach</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-3xl font-bold text-gray-900">—</p>
                      <p className="text-sm text-gray-500">Active sends</p>
                    </div>
                    <Link href="/send">
                      <Button className="w-full" variant="outline">
                        Go to Send
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* Contacts Card */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-50 rounded-lg">
                        <Users className="h-5 w-5 text-purple-600" />
                      </div>
                      <CardTitle className="text-lg">Contacts</CardTitle>
                    </div>
                  </div>
                  <CardDescription>Manage your contacts</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-3xl font-bold text-gray-900">
                        {stats.contactCount !== null ? stats.contactCount.toLocaleString() : '—'}
                      </p>
                      <p className="text-sm text-gray-500">Total contacts</p>
                    </div>
                    <Link href="/contacts">
                      <Button className="w-full" variant="outline">
                        Go to Contacts
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Usage Details Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Usage Details</h2>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Subscription Plan</CardTitle>
                    <CardDescription>
                      {plan.name} Plan
                      {stats.subscriptionTier !== 'free' && (
                        <span className="ml-2 text-blue-600">${(plan.monthlyPriceCents / 100).toFixed(2)}/mo</span>
                      )}
                    </CardDescription>
                  </div>
                  {stats.isAtLimit ? (
                    <div className="flex items-center gap-2 text-red-600">
                      <AlertCircle className="h-5 w-5" />
                      <span className="font-medium">At Limit</span>
                    </div>
                  ) : stats.isApproachingLimit ? (
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertCircle className="h-5 w-5" />
                      <span className="font-medium">Approaching Limit</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">Healthy</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Item Usage Progress */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Indexed Items</span>
                      <span className="text-sm text-gray-600">
                        {stats.itemCount !== null ? stats.itemCount.toLocaleString() : '0'} / {stats.itemLimit.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          stats.isAtLimit
                            ? 'bg-red-500'
                            : stats.isApproachingLimit
                              ? 'bg-amber-500'
                              : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(100, usagePercentage * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-gray-500">
                        {remainingItems > 0
                          ? `${remainingItems.toLocaleString()} items remaining`
                          : 'No items remaining'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {Math.round(usagePercentage * 100)}% used
                      </span>
                    </div>
                  </div>

                  {/* Contacts Count (no limit shown, just total) */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Contacts</span>
                      <span className="text-sm text-gray-600">
                        {stats.contactCount !== null ? stats.contactCount.toLocaleString() : '0'} total
                      </span>
                    </div>
                  </div>

                  {/* Upgrade CTA if approaching or at limit */}
                  {(stats.isAtLimit || stats.isApproachingLimit) && (
                    <div className="pt-4 border-t">
                      <Link href="/settings">
                        <Button className="w-full" variant="default">
                          Upgrade Plan
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
