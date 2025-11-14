export type SubscriptionTier = 'free' | 'pro' | 'pro_annual';
export interface SubscriptionPlan {
    id: SubscriptionTier;
    name: string;
    priceCents: number;
    billingInterval: 'month' | 'year';
    minIndexedItems: number;
    maxIndexedItems: number | null;
}
export declare const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan>;
export declare const PAID_TIERS: SubscriptionTier[];
export declare function getPlan(tier: SubscriptionTier): SubscriptionPlan;
export declare function getMaxIndexedItems(tier: SubscriptionTier): number;
export declare function isPaidTier(tier: SubscriptionTier): boolean;
export declare function coerceSubscriptionTier(value: unknown): SubscriptionTier;
//# sourceMappingURL=subscriptionPlans.d.ts.map