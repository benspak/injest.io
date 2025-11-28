import { getAnnualPlanPriceCents, getAnnualPlanDiscount } from './saleConfig';

export type SubscriptionTier = 'free' | 'pro' | 'pro_annual' | 'business';

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
// Annual price is always 80% off: $30/month * 12 * 0.2 = $72/year
const PRO_ANNUAL_PRICE_CENTS = getAnnualPlanPriceCents(PRO_MONTHLY_PRICE_CENTS);
// Business plan: $500/month normally, 80% off annual = $500 * 12 * 0.2 = $1200/year
const BUSINESS_ANNUAL_PRICE_CENTS = 120000; // $1200/year (80% off from $6000/year)

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
    description: `Cyber Week Sale: ${getAnnualPlanDiscount()}% off annual billing with dedicated onboarding. 25GB of storage.`,
  },
  business: {
    id: 'business',
    name: 'Business Annual',
    priceCents: BUSINESS_ANNUAL_PRICE_CENTS,
    billingInterval: 'year',
    maxIndexedItems: null,
    minIndexedItems: 0,
    description: `Cyber Week Sale: ${getAnnualPlanDiscount()}% off annual billing. Unlimited data storage for enterprise teams.`,
  },
};

export const PAID_PLAN_ORDER: SubscriptionTier[] = ['pro', 'pro_annual', 'business'];

export const DEFAULT_PAID_TIER: SubscriptionTier = 'pro_annual';

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
