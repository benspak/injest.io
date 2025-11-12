export type SubscriptionTier = 'free' | 'plus' | 'pro';

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
    maxIndexedItems: 250,
    minIndexedItems: 0,
    description: 'Get started with up to 250 indexed items.',
  },
  plus: {
    id: 'plus',
    name: 'Plus',
    monthlyPriceCents: 500,
    maxIndexedItems: 2500,
    minIndexedItems: 0,
    description: 'Perfect for growing libraries up to 2,500 items.',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthlyPriceCents: 2500,
    maxIndexedItems: 25000,
    minIndexedItems: 0,
    description: 'Scale to 25,000 indexed items with priority capacity.',
  },
};

export const PAID_PLAN_ORDER: SubscriptionTier[] = ['plus', 'pro'];

export const DEFAULT_PAID_TIER: SubscriptionTier = 'plus';

export function formatPlanPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
