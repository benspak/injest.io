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
     * Verify payment intent was successful
     */
    verifyPaymentIntent(paymentIntentId: string): Promise<boolean>;
    /**
     * Create a checkout session for bookmark import
     * This is an alternative approach that redirects to Stripe Checkout
     */
    createBookmarkImportCheckoutSession(userId: string, email: string, bookmarkCount: number, successUrl: string, cancelUrl: string): Promise<Stripe.Checkout.Session>;
}
export declare const stripeService: StripeService;
//# sourceMappingURL=stripe.d.ts.map