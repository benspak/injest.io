export type SubscriptionTier = 'free' | 'pro' | 'pro_annual';

export interface SubscriptionPlan {
  id: SubscriptionTier;
  name: string;
  priceCents: number;
  billingInterval: 'month' | 'year';
  minIndexedItems: number;
  maxIndexedItems: number | null;
}

const PRO_MONTHLY_PRICE_CENTS = 1200;
const PRO_ANNUAL_PRICE_CENTS = Math.round(PRO_MONTHLY_PRICE_CENTS * 12 * 0.8); // 20% discount

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
  free: {
    id: 'free',
    name: 'Free',
    priceCents: 0,
    billingInterval: 'month',
    minIndexedItems: 0,
    maxIndexedItems: 1000,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceCents: PRO_MONTHLY_PRICE_CENTS,
    billingInterval: 'month',
    minIndexedItems: 0,
    maxIndexedItems: null,
  },
  pro_annual: {
    id: 'pro_annual',
    name: 'Pro Annual',
    priceCents: PRO_ANNUAL_PRICE_CENTS,
    billingInterval: 'year',
    minIndexedItems: 0,
    maxIndexedItems: null,
  },
};

export const PAID_TIERS: SubscriptionTier[] = ['pro', 'pro_annual'];

export function getPlan(tier: SubscriptionTier): SubscriptionPlan {
  return SUBSCRIPTION_PLANS[tier];
}

export function getMaxIndexedItems(tier: SubscriptionTier): number {
  const plan = SUBSCRIPTION_PLANS[tier];
  return plan.maxIndexedItems ?? Number.POSITIVE_INFINITY;
}

export function isPaidTier(tier: SubscriptionTier): boolean {
  return PAID_TIERS.includes(tier);
}

export function coerceSubscriptionTier(value: unknown): SubscriptionTier {
  if (value === 'pro' || value === 'pro_annual') {
    return value;
  }
  if (value === 'plus') {
    return 'pro';
  }
  return 'free';
}
