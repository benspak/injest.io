const PRO_MONTHLY_PRICE_CENTS = 1200;
const PRO_ANNUAL_PRICE_CENTS = Math.round(PRO_MONTHLY_PRICE_CENTS * 12 * 0.8); // 20% discount
export const SUBSCRIPTION_PLANS = {
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
export const PAID_TIERS = ['pro', 'pro_annual'];
export function getPlan(tier) {
    return SUBSCRIPTION_PLANS[tier];
}
export function getMaxIndexedItems(tier) {
    const plan = SUBSCRIPTION_PLANS[tier];
    return plan.maxIndexedItems ?? Number.POSITIVE_INFINITY;
}
export function isPaidTier(tier) {
    return PAID_TIERS.includes(tier);
}
export function coerceSubscriptionTier(value) {
    if (value === 'pro' || value === 'pro_annual') {
        return value;
    }
    if (value === 'plus') {
        return 'pro';
    }
    return 'free';
}
//# sourceMappingURL=subscriptionPlans.js.map