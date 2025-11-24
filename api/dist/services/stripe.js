import Stripe from 'stripe';
import pool from '../config/database.js';
import { UserModel } from '../models/User.js';
import { ReferralModel } from '../models/Referral.js';
import { getPlan, coerceSubscriptionTier } from '../utils/subscriptionPlans.js';
// Stripe is optional - throw error only when actually used
// This allows the app to start without Stripe in development
// Initialize Stripe lazily to avoid errors if key is not set
let stripeInstance = null;
function getStripe() {
    if (!stripeInstance) {
        if (!process.env.STRIPE_SECRET_KEY) {
            throw new Error('STRIPE_SECRET_KEY environment variable is required');
        }
        stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: '2025-10-29.clover',
        });
    }
    return stripeInstance;
}
export class StripeService {
    /**
     * Create or retrieve a Stripe customer for a user
     */
    async getOrCreateCustomer(userId, email) {
        // Check if user already has a Stripe customer ID
        const user = await UserModel.findById(userId);
        if (user && user.stripe_customer_id) {
            return user.stripe_customer_id;
        }
        // Create a new Stripe customer
        const stripe = getStripe();
        const customer = await stripe.customers.create({
            email,
            metadata: {
                userId,
            },
        });
        // Save customer ID to database
        await pool.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customer.id, userId]);
        return customer.id;
    }
    /**
     * Create a payment intent for bookmark import
     * $5 for up to 555 bookmarks
     */
    async createBookmarkImportPaymentIntent(userId, email, bookmarkCount) {
        // Validate bookmark count
        if (bookmarkCount > 555) {
            throw new Error('Bookmark import limit is 555 bookmarks per payment');
        }
        const amount = 500; // $5 in cents
        const customerId = await this.getOrCreateCustomer(userId, email);
        const stripe = getStripe();
        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency: 'usd',
            customer: customerId,
            description: `Bookmark import: ${bookmarkCount} bookmarks`,
            metadata: {
                userId,
                bookmarkCount: bookmarkCount.toString(),
                type: 'bookmark_import',
            },
        });
        return paymentIntent;
    }
    /**
     * Create a payment intent for premium subscription
     * $5/month for unlimited items
     */
    async createSubscriptionPaymentIntent(userId, email, requestedTier) {
        const tier = coerceSubscriptionTier(requestedTier);
        const plan = getPlan(tier);
        if (plan.priceCents <= 0) {
            throw new Error('Cannot create payment intent for free tier');
        }
        // Check if user was referred and apply 10% discount
        // Note: Referral discounts are NOT applied to annual plan (pro_annual)
        const referral = await ReferralModel.findByReferredUserId(userId);
        const originalAmount = plan.priceCents;
        const amount = referral && tier !== 'pro_annual'
            ? Math.round(originalAmount * 0.9) // 10% discount for referred users (not for annual plan)
            : originalAmount;
        const customerId = await this.getOrCreateCustomer(userId, email);
        const stripe = getStripe();
        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency: 'usd',
            customer: customerId,
            description: `${plan.name} subscription (${plan.billingInterval})`,
            metadata: {
                userId,
                type: 'premium_subscription',
                subscription_tier: tier,
                billing_interval: plan.billingInterval,
            },
        });
        return paymentIntent;
    }
    /**
     * Verify payment intent was successful
     */
    async verifyPaymentIntent(paymentIntentId) {
        const stripe = getStripe();
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        return paymentIntent.status === 'succeeded';
    }
    /**
     * Create a checkout session for bookmark import
     * This is an alternative approach that redirects to Stripe Checkout
     */
    async createBookmarkImportCheckoutSession(userId, email, bookmarkCount, successUrl, cancelUrl) {
        if (bookmarkCount > 555) {
            throw new Error('Bookmark import limit is 555 bookmarks per payment');
        }
        const customerId = await this.getOrCreateCustomer(userId, email);
        const stripe = getStripe();
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'Bookmark Import',
                            description: `Import up to ${bookmarkCount} bookmarks`,
                        },
                        unit_amount: 500, // $5 in cents
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                userId,
                bookmarkCount: bookmarkCount.toString(),
                type: 'bookmark_import',
            },
        });
        return session;
    }
    /**
     * Create a Stripe Connect Express account
     */
    async createConnectAccount(userId, email) {
        const stripe = getStripe();
        try {
            const account = await stripe.accounts.create({
                type: 'express',
                country: 'US', // Default to US, can be made configurable
                email,
                metadata: {
                    userId,
                },
            });
            return account;
        }
        catch (error) {
            console.error('Stripe account creation error:', {
                type: error?.type,
                code: error?.code,
                message: error?.message,
                rawMessage: error?.raw?.message,
            });
            // Check if the error is about platform not being onboarded to Connect
            const errorMessage = error?.message || error?.raw?.message || '';
            const errorCode = error?.code || error?.raw?.code;
            if (errorCode === 'account_invalid' ||
                errorMessage.includes('Connect') ||
                errorMessage.includes('onboard') ||
                errorMessage.includes('You can only create new accounts')) {
                const platformError = new Error('Stripe Connect is not enabled for this account. ' +
                    'Please complete the platform onboarding at https://dashboard.stripe.com/settings/connect/platform-profile ' +
                    'before creating connected accounts.');
                platformError.code = errorCode || 'connect_not_enabled';
                platformError.type = error?.type || 'invalid_request_error';
                throw platformError;
            }
            throw error;
        }
    }
    /**
     * Create Stripe Connect onboarding link
     */
    async createConnectOnboardingLink(accountId, returnUrl, refreshUrl) {
        const stripe = getStripe();
        const accountLink = await stripe.accountLinks.create({
            account: accountId,
            return_url: returnUrl,
            refresh_url: refreshUrl,
            type: 'account_onboarding',
        });
        return accountLink;
    }
    /**
     * Get Stripe Connect account status
     */
    async getConnectAccountStatus(accountId) {
        const stripe = getStripe();
        return await stripe.accounts.retrieve(accountId);
    }
    /**
     * Check if user has a connected Stripe account
     */
    async hasConnectedAccount(userId) {
        const user = await UserModel.findById(userId);
        return Boolean(user?.stripe_connect_account_id);
    }
}
export const stripeService = new StripeService();
//# sourceMappingURL=stripe.js.map