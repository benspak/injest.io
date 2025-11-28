import { getAnnualPlanPriceCents } from './saleConfig.js';
const PRO_MONTHLY_PRICE_CENTS = 3000;
// Business plan: $500/month normally, 80% off annual = $500 * 12 * 0.2 = $1200/year
const BUSINESS_ANNUAL_PRICE_CENTS = 120000; // $1200/year (80% off from $6000/year)
// Base plans (annual price is calculated dynamically)
const BASE_PLANS = {
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
    business: {
        id: 'business',
        name: 'Business Annual',
        billingInterval: 'year',
        minIndexedItems: 0,
        maxIndexedItems: null,
    },
};
export const PAID_TIERS = ['pro', 'pro_annual', 'business'];
export function getPlan(tier) {
    const basePlan = BASE_PLANS[tier];
    if (!basePlan) {
        throw new Error(`Invalid subscription tier: ${tier}`);
    }
    // Calculate price dynamically (especially for annual plan which depends on sale status)
    let priceCents;
    if (tier === 'free') {
        priceCents = 0;
    }
    else if (tier === 'pro') {
        priceCents = PRO_MONTHLY_PRICE_CENTS;
    }
    else if (tier === 'business') {
        priceCents = BUSINESS_ANNUAL_PRICE_CENTS;
    }
    else {
        // pro_annual - calculate based on current sale status
        priceCents = getAnnualPlanPriceCents(PRO_MONTHLY_PRICE_CENTS);
    }
    return {
        ...basePlan,
        priceCents,
    };
}
// For backwards compatibility, export a getter that calculates plans dynamically
export const SUBSCRIPTION_PLANS = {
    get free() { return getPlan('free'); },
    get pro() { return getPlan('pro'); },
    get pro_annual() { return getPlan('pro_annual'); },
    get business() { return getPlan('business'); },
};
export function getMaxIndexedItems(tier) {
    const plan = SUBSCRIPTION_PLANS[tier];
    return plan.maxIndexedItems ?? Number.POSITIVE_INFINITY;
}
export function isPaidTier(tier) {
    return PAID_TIERS.includes(tier);
}
export function coerceSubscriptionTier(value) {
    if (value === 'pro' || value === 'pro_annual' || value === 'business') {
        return value;
    }
    if (value === 'plus') {
        return 'pro';
    }
    return 'free';
}
//# sourceMappingURL=subscriptionPlans.js.map