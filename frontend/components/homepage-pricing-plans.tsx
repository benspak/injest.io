'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { SubscriptionPaymentDialog } from '@/components/subscription-payment-dialog';
import { DEFAULT_PAID_TIER, PAID_PLAN_ORDER, type SubscriptionTier } from '@/lib/subscriptionPlans';
import { auth } from '@/lib/auth';
import { apiClient, type User } from '@/lib/api';

type PricingPlan = {
  tier: SubscriptionTier;
  name: string;
  badge?: string;
  priceDisplay: string;
  priceNote: string;
  limit: string;
  description: string;
  features: string[];
};

interface HomepagePricingPlansProps {
  plans: PricingPlan[];
}

const PAID_TIER_SET = new Set<SubscriptionTier>(PAID_PLAN_ORDER);

function getEffectiveTier(user: User | null): SubscriptionTier {
  if (!user) {
    return 'free';
  }
  if (user.subscription_tier) {
    return user.subscription_tier;
  }
  if (user.is_premium) {
    return 'pro';
  }
  return 'free';
}

export function HomepagePricingPlans({ plans }: HomepagePricingPlansProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(auth.getUser());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>(DEFAULT_PAID_TIER);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  useEffect(() => {
    let active = true;

    const restoreAuth = async () => {
      await auth.restore();
      if (!active) {
        return;
      }
      setCurrentUser(auth.getUser());
    };

    void restoreAuth();

    return () => {
      active = false;
    };
  }, []);

  const effectiveTier = useMemo(() => getEffectiveTier(currentUser), [currentUser]);

  const storeCheckoutPreference = useCallback((tier: SubscriptionTier) => {
    if (typeof window === 'undefined') {
      return;
    }
    sessionStorage.setItem('checkoutPlan', tier);
  }, []);

  const clearCheckoutPreference = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    sessionStorage.removeItem('checkoutPlan');
  }, []);

  const handlePlanSelect = useCallback(
    (tier: SubscriptionTier) => {
      if (tier === 'free') {
        router.push('/login');
        return;
      }

      if (!auth.isAuthenticated()) {
        storeCheckoutPreference(tier);
        router.push(`/login?plan=${encodeURIComponent(tier)}`);
        return;
      }

      setSelectedTier(tier);
      setDialogOpen(true);
    },
    [router, storeCheckoutPreference]
  );

  const handlePaymentComplete = useCallback(
    async (paymentIntentId: string) => {
      setVerifyingPayment(true);
      try {
        const verification = await apiClient.verifyPayment(paymentIntentId);
        if (verification.verified && verification.premium && verification.subscriptionTier) {
          toast.success(`${verification.subscriptionTier.toUpperCase()} plan activated!`);
          clearCheckoutPreference();

          try {
            const response = await apiClient.getCurrentUser();
            if (response.user) {
              auth.setUser(response.user);
              setCurrentUser(response.user);
            }
          } catch (error) {
            console.error('Failed to refresh user after subscription purchase:', error);
          }
        } else {
          toast.error(verification.message || 'Unable to verify payment. Please contact support.');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to verify payment';
        toast.error(message);
      } finally {
        setVerifyingPayment(false);
        setDialogOpen(false);
      }
    },
    [clearCheckoutPreference]
  );

  const handleDialogChange = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setVerifyingPayment(false);
    }
  }, []);

  const buttonLabelForTier = useCallback(
    (tier: SubscriptionTier, name: string) => {
      if (tier === 'free') {
        return 'Start for free';
      }

      if (effectiveTier === tier) {
        return `Current plan • ${name}`;
      }

      if (PAID_TIER_SET.has(effectiveTier) && PAID_TIER_SET.has(tier)) {
        const tierOrder = PAID_PLAN_ORDER;
        const currentIndex = tierOrder.indexOf(effectiveTier);
        const targetIndex = tierOrder.indexOf(tier);
        if (currentIndex > targetIndex) {
          return `Downgrade to ${name}`;
        }
        if (currentIndex === targetIndex) {
          return `Current plan • ${name}`;
        }
      }

      return `Choose ${name}`;
    },
    [effectiveTier]
  );

  return (
    <>
      <div className="grid gap-8 w-full max-w-6xl mx-auto md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => {
          const actionLabel = buttonLabelForTier(plan.tier, plan.name);
          const actionDisabled =
            plan.tier !== 'free' &&
            effectiveTier === plan.tier &&
            auth.isAuthenticated();

          const isSalePlan = plan.badge === 'Limited Time' || plan.badge === 'Cyber Week Sale';
          return (
            <Card
              key={plan.tier}
              className={`relative h-full shadow-lg border-2 transition hover:-translate-y-1 hover:shadow-xl ${
                isSalePlan ? 'border-red-500 ring-2 ring-red-200' : plan.badge ? 'border-blue-500' : 'border-gray-200'
              }`}
            >
              <CardHeader className="space-y-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl text-gray-900">{plan.name}</CardTitle>
                  {plan.badge && (
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      isSalePlan
                        ? 'bg-red-100 text-red-700 animate-pulse'
                        : 'bg-blue-100 text-blue-600'
                    }`}>
                      {plan.badge}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-gray-900">{plan.priceDisplay}</span>
                  <span className="text-sm text-gray-500">{plan.priceNote}</span>
                </div>
                <CardDescription className="text-base text-blue-600 font-medium">
                  {plan.limit}
                </CardDescription>
                <p className="text-sm text-gray-600">{plan.description}</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600 list-disc list-inside">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <Button
                  className="mt-6 w-full"
                  size="lg"
                  onClick={() => handlePlanSelect(plan.tier)}
                  disabled={actionDisabled || verifyingPayment}
                >
                  {verifyingPayment && plan.tier === selectedTier ? 'Finalizing...' : actionLabel}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <SubscriptionPaymentDialog
        open={dialogOpen}
        onOpenChange={handleDialogChange}
        onPaymentComplete={handlePaymentComplete}
        onCancel={() => handleDialogChange(false)}
        currentTier={effectiveTier}
        currentLimit={null}
        currentCount={null}
        initialTier={selectedTier}
      />
    </>
  );
}
