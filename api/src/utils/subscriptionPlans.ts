export type SubscriptionTier = 'free' | 'plus' | 'power' | 'pro';

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
    maxIndexedItems: 500,
  },
  plus: {
    id: 'plus',
    name: 'Plus',
    monthlyPriceCents: 500,
    minIndexedItems: 0,
    maxIndexedItems: 5000,
  },
  power: {
    id: 'power',
    name: 'Power User',
    monthlyPriceCents: 1500,
    minIndexedItems: 5000,
    maxIndexedItems: 25000,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthlyPriceCents: 3000,
    minIndexedItems: 25000,
    maxIndexedItems: 75000,
  },
};

export const PAID_TIERS: SubscriptionTier[] = ['plus', 'power', 'pro'];

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
  if (value === 'plus' || value === 'power' || value === 'pro') {
    return value;
  }
  return 'free';
}
