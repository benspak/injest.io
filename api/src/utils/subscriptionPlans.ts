export type SubscriptionTier = 'free' | 'plus' | 'pro';

export interface SubscriptionPlan {
  id: SubscriptionTier;
  name: string;
  monthlyPriceCents: number;
  minIndexedItems: number;
  maxIndexedItems: number;
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
  free: {
    id: 'free',
    name: 'Free',
    monthlyPriceCents: 0,
    minIndexedItems: 0,
    maxIndexedItems: 250,
  },
  plus: {
    id: 'plus',
    name: 'Plus',
    monthlyPriceCents: 500,
    minIndexedItems: 0,
    maxIndexedItems: 2500,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthlyPriceCents: 2500,
    minIndexedItems: 0,
    maxIndexedItems: 25000,
  },
};

export const PAID_TIERS: SubscriptionTier[] = ['plus', 'pro'];

export function getPlan(tier: SubscriptionTier): SubscriptionPlan {
  return SUBSCRIPTION_PLANS[tier];
}

export function getMaxIndexedItems(tier: SubscriptionTier): number {
  return SUBSCRIPTION_PLANS[tier].maxIndexedItems;
}

export function isPaidTier(tier: SubscriptionTier): boolean {
  return PAID_TIERS.includes(tier);
}

export function coerceSubscriptionTier(value: unknown): SubscriptionTier {
  if (value === 'plus' || value === 'pro') {
    return value;
  }
  return 'free';
}
