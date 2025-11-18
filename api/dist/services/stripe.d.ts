import Stripe from 'stripe';
export interface BookmarkImportPayment {
    amount: number;
    currency: string;
    description: string;
}
export declare class StripeService {
    /**
     * Create or retrieve a Stripe customer for a user
     */
    getOrCreateCustomer(userId: string, email: string): Promise<string>;
    /**
     * Create a payment intent for bookmark import
     * $5 for up to 555 bookmarks
     */
    createBookmarkImportPaymentIntent(userId: string, email: string, bookmarkCount: number): Promise<Stripe.PaymentIntent>;
    /**
     * Create a payment intent for premium subscription
     * $5/month for unlimited items
     */
    createSubscriptionPaymentIntent(userId: string, email: string, requestedTier: string | undefined): Promise<Stripe.PaymentIntent>;
    /**
     * Verify payment intent was successful
     */
    verifyPaymentIntent(paymentIntentId: string): Promise<boolean>;
    /**
     * Create a checkout session for bookmark import
     * This is an alternative approach that redirects to Stripe Checkout
     */
    createBookmarkImportCheckoutSession(userId: string, email: string, bookmarkCount: number, successUrl: string, cancelUrl: string): Promise<Stripe.Checkout.Session>;
    /**
     * Create a Stripe Connect Express account
     */
    createConnectAccount(userId: string, email: string): Promise<Stripe.Account>;
    /**
     * Create Stripe Connect onboarding link
     */
    createConnectOnboardingLink(accountId: string, returnUrl: string, refreshUrl: string): Promise<Stripe.AccountLink>;
    /**
     * Get Stripe Connect account status
     */
    getConnectAccountStatus(accountId: string): Promise<Stripe.Account>;
    /**
     * Check if user has a connected Stripe account
     */
    hasConnectedAccount(userId: string): Promise<boolean>;
}
export declare const stripeService: StripeService;
//# sourceMappingURL=stripe.d.ts.map