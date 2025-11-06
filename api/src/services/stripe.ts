import Stripe from 'stripe';
import pool from '../config/database.js';
import { UserModel } from '../models/User.js';

// Stripe is optional - throw error only when actually used
// This allows the app to start without Stripe in development

// Initialize Stripe lazily to avoid errors if key is not set
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
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

export interface BookmarkImportPayment {
  amount: number; // $5 in cents = 500
  currency: string;
  description: string;
}

export class StripeService {
  /**
   * Create or retrieve a Stripe customer for a user
   */
  async getOrCreateCustomer(userId: string, email: string): Promise<string> {
    // Check if user already has a Stripe customer ID
    const user = await UserModel.findById(userId);
    if (user && (user as any).stripe_customer_id) {
      return (user as any).stripe_customer_id;
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
    await pool.query(
      'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
      [customer.id, userId]
    );

    return customer.id;
  }

  /**
   * Create a payment intent for bookmark import
   * $5 for up to 555 bookmarks
   */
  async createBookmarkImportPaymentIntent(
    userId: string,
    email: string,
    bookmarkCount: number
  ): Promise<Stripe.PaymentIntent> {
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
   * Verify payment intent was successful
   */
  async verifyPaymentIntent(paymentIntentId: string): Promise<boolean> {
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    return paymentIntent.status === 'succeeded';
  }

  /**
   * Create a checkout session for bookmark import
   * This is an alternative approach that redirects to Stripe Checkout
   */
  async createBookmarkImportCheckoutSession(
    userId: string,
    email: string,
    bookmarkCount: number,
    successUrl: string,
    cancelUrl: string
  ): Promise<Stripe.Checkout.Session> {
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
}

export const stripeService = new StripeService();
