import { getAnnualPlanPriceCents } from './saleConfig.js';

export type SubscriptionTier = 'free' | 'pro' | 'pro_annual';

export interface SubscriptionPlan {
  id: SubscriptionTier;
  name: string;
  priceCents: number;
  billingInterval: 'month' | 'year';
  minIndexedItems: number;
  maxIndexedItems: number | null;
}

const PRO_MONTHLY_PRICE_CENTS = 3000;

// Base plans (annual price is calculated dynamically)
const BASE_PLANS: Record<SubscriptionTier, Omit<SubscriptionPlan, 'priceCents'>> = {
  free: {
    id: 'free',
    name: 'Free',
    billingInterval: 'month',
    minIndexedItems: 0,
    maxIndexedItems: 1000,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    billingInterval: 'month',
    minIndexedItems: 0,
    maxIndexedItems: null,
  },
  pro_annual: {
    id: 'pro_annual',
    name: 'Pro Annual',
    billingInterval: 'year',
    minIndexedItems: 0,
    maxIndexedItems: null,
  },
};

export const PAID_TIERS: SubscriptionTier[] = ['pro', 'pro_annual'];

export function getPlan(tier: SubscriptionTier): SubscriptionPlan {
  const basePlan = BASE_PLANS[tier];

  if (!basePlan) {
    throw new Error(`Invalid subscription tier: ${tier}`);
  }

  // Calculate price dynamically (especially for annual plan which depends on sale status)
  let priceCents: number;
  if (tier === 'free') {
    priceCents = 0;
  } else if (tier === 'pro') {
    priceCents = PRO_MONTHLY_PRICE_CENTS;
  } else {
    // pro_annual - calculate based on current sale status
    priceCents = getAnnualPlanPriceCents(PRO_MONTHLY_PRICE_CENTS);
  }

  return {
    ...basePlan,
    priceCents,
  };
}

// For backwards compatibility, export a getter that calculates plans dynamically
export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
  get free() { return getPlan('free'); },
  get pro() { return getPlan('pro'); },
  get pro_annual() { return getPlan('pro_annual'); },
};

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
