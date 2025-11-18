import express from 'express';
import Stripe from 'stripe';
import { AffiliateService } from '../services/affiliate.js';
const router = express.Router();
// Stripe webhook endpoint must use raw body for signature verification
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!sig || !webhookSecret) {
        console.error('Missing Stripe signature or webhook secret');
        return res.status(400).send('Missing signature or webhook secret');
    }
    let event;
    try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
            apiVersion: '2025-10-29.clover',
        });
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    }
    catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    // Acknowledge receipt immediately
    res.json({ received: true });
    // Process event asynchronously
    setImmediate(async () => {
        try {
            await handleStripeEvent(event);
        }
        catch (error) {
            console.error('Error processing Stripe webhook:', error);
        }
    });
});
async function handleStripeEvent(event) {
    switch (event.type) {
        case 'payment_intent.succeeded':
            await handlePaymentIntentSucceeded(event.data.object);
            break;
        case 'payment_intent.payment_failed':
            await handlePaymentIntentFailed(event.data.object);
            break;
        case 'account.updated':
            // Handle Stripe Connect account updates if needed
            break;
        default:
            console.log(`Unhandled event type: ${event.type}`);
    }
}
async function handlePaymentIntentSucceeded(paymentIntent) {
    // Only process premium subscription payments
    if (paymentIntent.metadata?.type !== 'premium_subscription') {
        return;
    }
    const userId = paymentIntent.metadata?.userId;
    if (!userId) {
        console.error('Payment intent missing userId metadata');
        return;
    }
    const amountCents = paymentIntent.amount;
    if (!amountCents || amountCents <= 0) {
        return;
    }
    // Process commission
    try {
        await AffiliateService.processCommission(paymentIntent.id, userId, amountCents);
    }
    catch (error) {
        console.error('Error processing commission:', error);
    }
}
async function handlePaymentIntentFailed(paymentIntent) {
    // Handle failed payments if needed (e.g., mark commissions as failed)
    // For now, we'll leave pending commissions as-is
    console.log('Payment intent failed:', paymentIntent.id);
}
export default router;
//# sourceMappingURL=stripe-webhook.js.map