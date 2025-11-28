'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Inbox, Users, ArrowRight, CheckCircle2, AlertCircle, Upload, Bookmark, Mail, Info, Flame, MessageSquare, ExternalLink } from 'lucide-react';
import { AnnouncementBanner } from '@/components/announcement-banner';
import { AvatarMenu } from '@/components/avatar-menu';
import { FeedbackDialog } from '@/components/feedback-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { auth } from '@/lib/auth';
import { SUBSCRIPTION_PLANS, formatPlanRate } from '@/lib/subscriptionPlans';

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
  const [loginStreak, setLoginStreak] = useState<{
    currentStreak: number;
    weekDays: number[];
  } | null>(null);
  const [streakLoading, setStreakLoading] = useState(false);
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

        // Load login streak
        setStreakLoading(true);
        try {
          const streakData = await apiClient.getLoginStreak();
          setLoginStreak(streakData);
        } catch (error) {
          console.error('Failed to load login streak:', error);
        } finally {
          setStreakLoading(false);
        }
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
  const hasUnlimitedItems = !Number.isFinite(stats.itemLimit);
  const usagePercentage =
    !hasUnlimitedItems && stats.itemLimit > 0 ? (stats.itemCount || 0) / stats.itemLimit : 0;
  const remainingItems = hasUnlimitedItems ? Infinity : Math.max(0, stats.itemLimit - (stats.itemCount || 0));
  const inboxAddressExample =
    currentUser?.public_username && currentUser.public_username.trim().length > 0
      ? `${currentUser.public_username}@injest.io`
      : 'your-username@injest.io';

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
          {/* Get Started Section */}
          <Card className="bg-linear-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Info className="h-5 w-5 text-blue-600" />
                </div>
                <CardTitle className="text-lg">Get Started</CardTitle>
              </div>
              <CardDescription className="text-gray-700">
                Start adding content to your inbox in three easy ways
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-xs">
                    <Upload className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Upload Files</p>
                    <p className="text-sm text-gray-600">Upload documents, PDFs, and more</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-xs">
                    <Bookmark className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Add Bookmarks</p>
                    <p className="text-sm text-gray-600">Save web pages and links</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-xs">
                    <Mail className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Forward Email</p>
                    <p className="text-sm text-gray-600">
                      Forward emails to your Injest address{' '}
                      <span className="font-mono font-semibold text-blue-700">
                        {inboxAddressExample}
                      </span>
                      . Choose your username in Profile Settings.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Integrations Section */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Slack Integration Card */}
            <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <MessageSquare className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Connect with Slack</CardTitle>
                    <CardDescription className="text-gray-700">
                      Integrate Injest with Slack to easily save messages, files, and conversations directly to your inbox
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <a
                    href="https://slack.com/oauth/v2/authorize?client_id=9933741812099.9968460027264&scope=channels:history,channels:read,chat:write,commands,files:read,groups:history,groups:read,im:history,im:read,mpim:history,mpim:read,reactions:read,users:read&user_scope=channels:history,groups:history,im:history,mpim:history"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      alt="Add to Slack"
                      height="40"
                      width="139"
                      src="https://platform.slack-edge.com/img/add_to_slack.png"
                      srcSet="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x"
                      className="hover:opacity-80 transition-opacity"
                    />
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* Chrome Extension Card */}
            <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <ExternalLink className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Chrome Extension</CardTitle>
                    <CardDescription className="text-gray-700">
                      Capture links, files, and screenshots straight from your browser with our Chrome extension
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <a
                    href="https://chromewebstore.google.com/detail/injest-capture/goiocnfkcilgalpmbjbkhdjdblcokpjl"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="default" className="bg-blue-600 hover:bg-blue-700 text-white">
                      Install Chrome Extension
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>

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

          {/* Login Streak Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity</h2>
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-50 rounded-lg">
                    <Flame className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Login Streak</CardTitle>
                    <CardDescription>Your weekly activity</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {streakLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                  </div>
                ) : loginStreak ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-3xl font-bold text-gray-900">
                        {loginStreak.currentStreak} <span className="text-lg font-normal text-gray-600">days</span>
                      </p>
                      <p className="text-sm text-gray-500">This week</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">Week overview</p>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                          const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                          const isLoggedIn = loginStreak.weekDays.includes(day);
                          return (
                            <div key={day} className="flex-1 text-center">
                              <div
                                className={`w-full aspect-square rounded-lg flex items-center justify-center mb-1 ${
                                  isLoggedIn
                                    ? 'bg-orange-500 text-white'
                                    : 'bg-gray-100 text-gray-400'
                                }`}
                              >
                                {isLoggedIn ? (
                                  <CheckCircle2 className="h-4 w-4" />
                                ) : (
                                  <div className="h-2 w-2 rounded-full bg-current" />
                                )}
                              </div>
                              <p className="text-xs text-gray-600">{dayNames[day - 1]}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">
                      You've used Injest {loginStreak.currentStreak} out of 7 days this week
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">No streak data available</p>
                )}
              </CardContent>
            </Card>
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
                        <span className="ml-2 text-blue-600">{formatPlanRate(plan)}</span>
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
                        {stats.itemCount !== null ? stats.itemCount.toLocaleString() : '0'} /{' '}
                        {hasUnlimitedItems ? 'Unlimited' : stats.itemLimit.toLocaleString()}
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
                        {hasUnlimitedItems
                          ? 'Unlimited items remaining'
                          : remainingItems > 0
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
