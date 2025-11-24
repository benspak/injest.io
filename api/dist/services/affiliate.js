import Stripe from 'stripe';
import { ReferralModel } from '../models/Referral.js';
import { ReferralCommissionModel } from '../models/ReferralCommission.js';
import { UserModel } from '../models/User.js';
const COMMISSION_PERCENTAGE = 0.20; // 20%
function getStripe() {
    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    return new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2025-10-29.clover',
    });
}
export class AffiliateService {
    /**
     * Calculate commission amount (20% of discounted payment)
     */
    static calculateCommission(amountCents) {
        return Math.round(amountCents * COMMISSION_PERCENTAGE);
    }
    /**
     * Process commission for a successful payment
     * Note: Commissions are NOT processed for annual plan (pro_annual)
     */
    static async processCommission(paymentIntentId, userId, amountCents, subscriptionTier) {
        // Skip commission processing for annual plan
        if (subscriptionTier === 'pro_annual') {
            return;
        }
        // Find referral relationship for this user
        const referral = await ReferralModel.findByReferredUserId(userId);
        if (!referral) {
            // No referral, no commission
            return;
        }
        // Check if commission already exists for this payment
        const existingCommission = await ReferralCommissionModel.findByPaymentIntentId(paymentIntentId);
        if (existingCommission) {
            // Commission already processed
            return;
        }
        // Calculate commission
        const commissionAmount = this.calculateCommission(amountCents);
        // Create commission record
        const commission = await ReferralCommissionModel.create(referral.id, paymentIntentId, commissionAmount, 'pending');
        // Try to transfer to referrer if they have Stripe Connect account
        const referrer = await UserModel.findById(referral.referrer_id);
        if (referrer?.stripe_connect_account_id) {
            try {
                await this.transferCommission(referrer.stripe_connect_account_id, commissionAmount, commission.id);
            }
            catch (error) {
                console.error('Error transferring commission:', error);
                // Commission remains pending, can be retried later
            }
        }
    }
    /**
     * Transfer commission to Stripe Connect account
     */
    static async transferCommission(connectAccountId, amountCents, commissionId) {
        const stripe = getStripe();
        try {
            const transfer = await stripe.transfers.create({
                amount: amountCents,
                currency: 'usd',
                destination: connectAccountId,
                metadata: {
                    commission_id: commissionId,
                    type: 'referral_commission',
                },
            });
            // Update commission status
            await ReferralCommissionModel.updateStatus(commissionId, 'paid', transfer.id, new Date());
        }
        catch (error) {
            console.error('Stripe transfer error:', error);
            // Mark as failed if transfer fails
            await ReferralCommissionModel.updateStatus(commissionId, 'failed');
            throw error;
        }
    }
    /**
     * Retry failed commission transfer
     */
    static async retryCommission(commissionId) {
        const comm = await ReferralCommissionModel.findById(commissionId);
        if (!comm) {
            throw new Error('Commission not found');
        }
        if (comm.status !== 'failed' && comm.status !== 'pending') {
            throw new Error('Commission cannot be retried');
        }
        const referral = await ReferralModel.findById(comm.referral_id);
        if (!referral) {
            throw new Error('Referral not found');
        }
        const referrer = await UserModel.findById(referral.referrer_id);
        if (!referrer?.stripe_connect_account_id) {
            throw new Error('Referrer does not have Stripe Connect account');
        }
        await this.transferCommission(referrer.stripe_connect_account_id, comm.amount_cents, comm.id);
    }
}
//# sourceMappingURL=affiliate.js.map