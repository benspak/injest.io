export type SubscriptionTier = 'free' | 'pro' | 'pro_annual';

export interface SubscriptionPlan {
  id: SubscriptionTier;
  name: string;
  priceCents: number;
  billingInterval: 'month' | 'year';
  maxIndexedItems: number | null;
  minIndexedItems: number;
  description: string;
}

const PRO_MONTHLY_PRICE_CENTS = 3000;
const PRO_ANNUAL_PRICE_CENTS = Math.round(PRO_MONTHLY_PRICE_CENTS * 12 * 0.8); // 20% discount

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
  free: {
    id: 'free',
    name: 'Free',
    priceCents: 0,
    billingInterval: 'month',
    maxIndexedItems: 1000,
    minIndexedItems: 0,
    description: 'Get started with up to 1,000 indexed items and Pro ingestion features.',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceCents: PRO_MONTHLY_PRICE_CENTS,
    billingInterval: 'month',
    maxIndexedItems: null,
    minIndexedItems: 0,
    description: 'Unlimited items, automation, and priority ingest for teams.',
  },
  pro_annual: {
    id: 'pro_annual',
    name: 'Pro Annual',
    priceCents: PRO_ANNUAL_PRICE_CENTS,
    billingInterval: 'year',
    maxIndexedItems: null,
    minIndexedItems: 0,
    description: 'Save 20% with annual billing while keeping unlimited items.',
  },
};

export const PAID_PLAN_ORDER: SubscriptionTier[] = ['pro', 'pro_annual'];

export const DEFAULT_PAID_TIER: SubscriptionTier = 'pro';

export function formatPlanPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatPlanRate(plan: SubscriptionPlan): string {
  const suffix = plan.billingInterval === 'year' ? '/year' : '/month';
  return `${formatPlanPrice(plan.priceCents)}${suffix}`;
}

export function formatPlanLimit(plan: SubscriptionPlan): string {
  return typeof plan.maxIndexedItems === 'number'
    ? `Up to ${plan.maxIndexedItems.toLocaleString()} items`
    : 'Unlimited items';
}
