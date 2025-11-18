import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { ReferralService } from '../services/referral.js';
import { ReferralModel } from '../models/Referral.js';
import { ReferralCommissionModel } from '../models/ReferralCommission.js';
import { stripeService } from '../services/stripe.js';
import { UserModel } from '../models/User.js';
import { FRONTEND_URL } from '../config/auth.js';
const router = express.Router();
router.use(authMiddleware);
/**
 * Create or update user's referral code
 * POST /api/referral/code
 * Body: { code: string }
 */
router.post('/code', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { code } = req.body;
        if (!code || typeof code !== 'string') {
            return res.status(400).json({ error: 'Referral code is required' });
        }
        await ReferralService.setReferralCode(req.user.id, code);
        const user = await UserModel.findById(req.user.id);
        res.json({
            success: true,
            referral_code: user?.referral_code || null,
        });
    }
    catch (error) {
        console.error('Error setting referral code:', error);
        res.status(400).json({
            error: error.message || 'Failed to set referral code',
        });
    }
});
/**
 * Get user's referral code
 * GET /api/referral/code
 */
router.get('/code', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const user = await UserModel.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            referral_code: user.referral_code || null,
        });
    }
    catch (error) {
        console.error('Error getting referral code:', error);
        res.status(500).json({ error: 'Failed to get referral code' });
    }
});
/**
 * Get referral statistics
 * GET /api/referral/stats
 */
router.get('/stats', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const user = await UserModel.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const totalReferrals = await ReferralModel.countByReferrerId(req.user.id);
        const totalEarnings = await ReferralCommissionModel.getTotalEarningsByReferrerId(req.user.id);
        const pendingEarnings = await ReferralCommissionModel.getPendingEarningsByReferrerId(req.user.id);
        const hasConnectedAccount = await stripeService.hasConnectedAccount(req.user.id);
        res.json({
            referral_code: user.referral_code || null,
            total_referrals: totalReferrals,
            total_earnings_cents: totalEarnings,
            pending_earnings_cents: pendingEarnings,
            has_connected_account: hasConnectedAccount,
        });
    }
    catch (error) {
        console.error('Error getting referral stats:', error);
        res.status(500).json({ error: 'Failed to get referral stats' });
    }
});
/**
 * Get commission history
 * GET /api/referral/commissions
 */
router.get('/commissions', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
        const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
        const commissions = await ReferralCommissionModel.getCommissionsByReferrerId(req.user.id, limit, offset);
        res.json({
            commissions,
            pagination: {
                limit,
                offset,
                has_more: commissions.length === limit,
            },
        });
    }
    catch (error) {
        console.error('Error getting commissions:', error);
        res.status(500).json({ error: 'Failed to get commissions' });
    }
});
/**
 * Create Stripe Connect account and get onboarding link
 * POST /api/referral/connect/setup
 */
router.post('/connect/setup', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const user = await UserModel.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Check if user already has a connected account
        if (user.stripe_connect_account_id) {
            // Get account status
            const account = await stripeService.getConnectAccountStatus(user.stripe_connect_account_id);
            const returnUrl = `${FRONTEND_URL}/referrals?return=connect`;
            const refreshUrl = `${FRONTEND_URL}/referrals?refresh=connect`;
            // Check if account needs more information
            if (account.details_submitted) {
                return res.json({
                    account_id: account.id,
                    details_submitted: true,
                    charges_enabled: account.charges_enabled,
                    payouts_enabled: account.payouts_enabled,
                });
            }
            else {
                // Create new onboarding link
                const accountLink = await stripeService.createConnectOnboardingLink(account.id, returnUrl, refreshUrl);
                return res.json({
                    onboarding_url: accountLink.url,
                    account_id: account.id,
                });
            }
        }
        // Create new Connect account
        const account = await stripeService.createConnectAccount(req.user.id, user.email);
        await UserModel.update(req.user.id, {
            stripe_connect_account_id: account.id,
        });
        const returnUrl = `${FRONTEND_URL}/referrals?return=connect`;
        const refreshUrl = `${FRONTEND_URL}/referrals?refresh=connect`;
        const accountLink = await stripeService.createConnectOnboardingLink(account.id, returnUrl, refreshUrl);
        res.json({
            onboarding_url: accountLink.url,
            account_id: account.id,
        });
    }
    catch (error) {
        console.error('Error setting up Stripe Connect:', error);
        // Safely serialize error for logging
        const errorInfo = {
            type: typeof error,
            message: error?.message,
            code: error?.code,
            type_prop: error?.type,
        };
        if (error?.raw) {
            errorInfo.raw_message = error.raw.message;
            errorInfo.raw_code = error.raw.code;
        }
        try {
            console.error('Error details:', JSON.stringify(errorInfo, null, 2));
        }
        catch (e) {
            console.error('Error details (could not serialize):', errorInfo);
        }
        // Extract error message from various possible error structures
        let errorMessage = 'Failed to setup Stripe Connect';
        if (error?.message) {
            errorMessage = error.message;
        }
        else if (typeof error === 'string') {
            errorMessage = error;
        }
        else if (error?.error?.message) {
            errorMessage = error.error.message;
        }
        else if (error?.raw?.message) {
            errorMessage = error.raw.message;
        }
        else if (error?.type && error?.message) {
            errorMessage = `${error.type}: ${error.message}`;
        }
        // For Stripe errors, try to get the raw message
        if (error?.raw?.message && !errorMessage.includes(error.raw.message)) {
            errorMessage = error.raw.message;
        }
        // Check if this is a platform onboarding error
        const isPlatformOnboardingError = errorMessage.includes('platform-profile') ||
            errorMessage.includes('Connect is not enabled') ||
            errorMessage.includes('You can only create new accounts') ||
            error?.code === 'account_invalid' ||
            error?.type === 'invalid_request_error';
        res.status(500).json({
            error: isPlatformOnboardingError
                ? 'Stripe Connect platform onboarding required'
                : 'Failed to setup Stripe Connect',
            details: errorMessage,
            requires_platform_onboarding: isPlatformOnboardingError,
            platform_onboarding_url: isPlatformOnboardingError
                ? 'https://dashboard.stripe.com/settings/connect/platform-profile'
                : undefined,
            // Include additional error info in development
            ...(process.env.NODE_ENV === 'development' && {
                error_code: error?.code,
                error_type: error?.type,
                full_error: error,
            }),
        });
    }
});
/**
 * Get Stripe Connect account status
 * GET /api/referral/connect/status
 */
router.get('/connect/status', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const user = await UserModel.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (!user.stripe_connect_account_id) {
            return res.json({
                has_account: false,
            });
        }
        const account = await stripeService.getConnectAccountStatus(user.stripe_connect_account_id);
        res.json({
            has_account: true,
            account_id: account.id,
            details_submitted: account.details_submitted,
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
        });
    }
    catch (error) {
        console.error('Error getting Connect status:', error);
        res.status(500).json({ error: 'Failed to get Connect status' });
    }
});
export default router;
//# sourceMappingURL=referral.js.map