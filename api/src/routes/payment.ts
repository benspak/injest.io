import express from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { stripeService } from '../services/stripe.js';
import { UserModel } from '../models/User.js';
import Stripe from 'stripe';

const router = express.Router();
router.use(authMiddleware);

/**
 * Create a payment intent for bookmark import
 * POST /api/payment/bookmark-import
 * Body: { bookmarkCount: number }
 */
router.post('/bookmark-import', async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { bookmarkCount } = req.body;

    if (!bookmarkCount || typeof bookmarkCount !== 'number' || bookmarkCount <= 0) {
      return res.status(400).json({ error: 'Invalid bookmark count' });
    }

    if (bookmarkCount > 555) {
      return res.status(400).json({ error: 'Bookmark import limit is 555 bookmarks per payment' });
    }

    // Get user to check premium status
    const user = await UserModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user is premium (they can import for free)
    if (user.is_premium) {
      return res.status(200).json({
        message: 'Premium user - no payment required',
        premium: true,
      });
    }

    // Create payment intent
    const paymentIntent = await stripeService.createBookmarkImportPaymentIntent(
      req.user.id,
      user.email,
      bookmarkCount
    );

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    });
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({
      error: 'Failed to create payment intent',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * Create a payment intent for premium subscription
 * POST /api/payment/premium-subscription
 */
router.post('/premium-subscription', async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user to check premium status
    const user = await UserModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user is already premium
    if (user.is_premium) {
      return res.status(200).json({
        message: 'User is already premium',
        premium: true,
      });
    }

    // Create payment intent
    const paymentIntent = await stripeService.createPremiumSubscriptionPaymentIntent(
      req.user.id,
      user.email
    );

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    });
  } catch (error: any) {
    console.error('Error creating premium subscription payment intent:', error);
    res.status(500).json({
      error: 'Failed to create payment intent',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * Verify payment and mark user as premium for bookmark import
 * POST /api/payment/verify
 * Body: { paymentIntentId: string }
 */
router.post('/verify', async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { paymentIntentId } = req.body;

    if (!paymentIntentId || typeof paymentIntentId !== 'string') {
      return res.status(400).json({ error: 'Invalid payment intent ID' });
    }

    // Verify payment with Stripe
    const isVerified = await stripeService.verifyPaymentIntent(paymentIntentId);

    if (!isVerified) {
      return res.status(400).json({ error: 'Payment not verified' });
    }

    // Get payment intent to check type
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-10-29.clover',
    });
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const paymentType = paymentIntent.metadata?.type;

    // Update user's bookmark import count and payment timestamp
    const user = await UserModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (paymentType === 'premium_subscription') {
      // Mark user as premium
      await UserModel.update(req.user.id, {
        is_premium: true,
      });

      return res.json({
        verified: true,
        message: 'Premium subscription activated successfully',
        premium: true,
      });
    } else {
      // Bookmark import payment
      await UserModel.update(req.user.id, {
        bookmark_import_count: (user.bookmark_import_count || 0) + 1,
        last_bookmark_import_payment: new Date(),
      });

      return res.json({
        verified: true,
        message: 'Payment verified successfully',
      });
    }
  } catch (error: any) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      error: 'Failed to verify payment',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

export default router;
