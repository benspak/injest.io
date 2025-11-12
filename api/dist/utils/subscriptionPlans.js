export const SUBSCRIPTION_PLANS = {
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
export const PAID_TIERS = ['plus', 'pro'];
export function getPlan(tier) {
    return SUBSCRIPTION_PLANS[tier];
}
export function getMaxIndexedItems(tier) {
    return SUBSCRIPTION_PLANS[tier].maxIndexedItems;
}
export function isPaidTier(tier) {
    return PAID_TIERS.includes(tier);
}
export function coerceSubscriptionTier(value) {
    if (value === 'plus' || value === 'pro') {
        return value;
    }
    return 'free';
}
//# sourceMappingURL=subscriptionPlans.js.map