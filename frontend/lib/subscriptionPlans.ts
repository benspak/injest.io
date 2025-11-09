export type SubscriptionTier = 'free' | 'plus' | 'power' | 'pro';

export interface SubscriptionPlan {
  id: SubscriptionTier;
  name: string;
  monthlyPriceCents: number;
  maxIndexedItems: number;
  minIndexedItems: number;
  description: string;
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
  free: {
    id: 'free',
    name: 'Free',
    monthlyPriceCents: 0,
    maxIndexedItems: 500,
    minIndexedItems: 0,
    description: 'Get started with up to 500 indexed items.',
  },
  plus: {
    id: 'plus',
    name: 'Plus',
    monthlyPriceCents: 500,
    maxIndexedItems: 5000,
    minIndexedItems: 0,
    description: 'Perfect for growing libraries up to 5,000 items.',
  },
  power: {
    id: 'power',
    name: 'Power User',
    monthlyPriceCents: 1500,
    maxIndexedItems: 25000,
    minIndexedItems: 5000,
    description: 'For serious collectors managing up to 25,000 items.',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthlyPriceCents: 3000,
    maxIndexedItems: 75000,
    minIndexedItems: 25000,
    description: 'Scale to 75,000 indexed items with priority capacity.',
  },
};

export const PAID_PLAN_ORDER: SubscriptionTier[] = ['plus', 'power', 'pro'];

export const DEFAULT_PAID_TIER: SubscriptionTier = 'plus';

export function formatPlanPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
