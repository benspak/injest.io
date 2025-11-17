import express from 'express';
import { UserModel } from '../models/User.js';
import { emailService } from '../services/email.js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN, FRONTEND_URL } from '../config/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { generateApiKey, hashApiKey } from '../utils/apiKeys.js';
import { coerceSubscriptionTier } from '../utils/subscriptionPlans.js';
import { ItemAccessModel } from '../models/ItemAccess.js';
import { LoginSessionModel } from '../models/LoginSession.js';
import { generateTwoFactorSecret, verifyTwoFactorToken, generateRecoveryCodes, hashRecoveryCode, verifyRecoveryCode, } from '../services/twoFactor.js';
const router = express.Router();
const TWO_FACTOR_PENDING_EXPIRATION = '10m';
function createSessionToken(user) {
    return jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}
function createPendingTwoFactorToken(user) {
    return jwt.sign({ userId: user.id, email: user.email, twoFactorPending: true }, JWT_SECRET, { expiresIn: TWO_FACTOR_PENDING_EXPIRATION });
}
function buildUserResponse(user) {
    return {
        id: user.id,
        email: user.email,
        verified: user.verified,
        is_premium: user.is_premium || false,
        subscription_tier: coerceSubscriptionTier(user.subscription_tier),
        two_factor_enabled: user.two_factor_enabled || false,
        two_factor_confirmed_at: user.two_factor_confirmed_at || null,
        public_username: user.public_username || null,
        profile_private: user.profile_private || false,
        inbound_email_handle: user.inbound_email_handle || null,
    };
}
// Send magic link
router.post('/magic-link', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        // Find or create user
        let user = await UserModel.findByEmail(email);
        if (!user) {
            user = await UserModel.create(email);
        }
        await ItemAccessModel.linkUserToEmail(user.id, user.email);
        // Generate JWT token
        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        // Send magic link email
        const magicLink = `${FRONTEND_URL}/auth/verify?token=${token}`;
        await emailService.sendMagicLink(email, magicLink);
        res.json({ message: 'Magic link sent to your email' });
    }
    catch (error) {
        console.error('Error sending magic link:', error);
        res.status(500).json({ error: 'Failed to send magic link' });
    }
});
// Verify magic link token
router.get('/verify', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token || typeof token !== 'string') {
            return res.status(400).json({ error: 'Token is required' });
        }
        const decoded = jwt.verify(token, JWT_SECRET);
        // Get user before verification
        const userBefore = await UserModel.findById(decoded.userId);
        // Verify user email
        const user = await UserModel.verifyEmail(decoded.userId);
        // Send approval email if this is the first verification
        if (userBefore && !userBefore.verified && user.verified) {
            await emailService.sendApprovalEmail(user.email);
        }
        const responseUser = buildUserResponse(user);
        if (user.two_factor_enabled && user.two_factor_secret) {
            const pendingToken = createPendingTwoFactorToken(user);
            return res.json({
                twoFactorRequired: true,
                pendingToken,
                user: responseUser,
            });
        }
        const sessionToken = createSessionToken(user);
        // Record login session
        try {
            await LoginSessionModel.create(user.id);
        }
        catch (error) {
            // Log error but don't fail the login
            console.error('Error recording login session:', error);
        }
        res.json({
            token: sessionToken,
            user: responseUser,
        });
    }
    catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        console.error('Error verifying token:', error);
        res.status(500).json({ error: 'Failed to verify token' });
    }
});
// Get current user (requires auth middleware)
router.get('/me', authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const user = await UserModel.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            user: buildUserResponse(user),
        });
    }
    catch (error) {
        console.error('Error getting current user:', error);
        res.status(500).json({ error: 'Failed to get current user' });
    }
});
router.get('/2fa', authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const user = await UserModel.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            enabled: Boolean(user.two_factor_enabled),
            confirmedAt: user.two_factor_confirmed_at || null,
            recoveryCodesRemaining: user.two_factor_recovery_codes?.length ?? 0,
        });
    }
    catch (error) {
        console.error('Error fetching 2FA status:', error);
        res.status(500).json({ error: 'Failed to fetch 2FA status' });
    }
});
// Update inbound email handle
router.put('/inbound-handle', authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { handle } = req.body;
        if (handle !== null && handle !== undefined) {
            const trimmed = handle.trim().toLowerCase();
            if (trimmed.length === 0) {
                return res.status(400).json({ error: 'Handle cannot be empty' });
            }
            // Allow letters, numbers, dots, dashes, and underscores
            if (!/^[a-z0-9._-]+$/.test(trimmed)) {
                return res.status(400).json({
                    error: 'Handle can only contain letters, numbers, dots, dashes, and underscores',
                });
            }
            // Reserve common system/local parts
            const reserved = new Set(['noreply', 'no-reply', 'admin', 'support', 'info', 'postmaster']);
            if (reserved.has(trimmed)) {
                return res.status(400).json({ error: 'This handle is reserved. Please choose another.' });
            }
            // Ensure uniqueness by checking if any other user already has this handle
            const existing = await UserModel.findByInboundHandle(trimmed);
            if (existing && existing.id !== req.user.id) {
                return res.status(409).json({ error: 'This handle is already taken. Please choose another.' });
            }
        }
        const user = await UserModel.update(req.user.id, {
            inbound_email_handle: handle ? handle.trim().toLowerCase() : null,
        });
        res.json({ user: buildUserResponse(user) });
    }
    catch (error) {
        console.error('Error updating inbound handle:', error);
        res.status(500).json({ error: 'Failed to update inbound email handle' });
    }
});
router.post('/2fa/setup', authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const user = await UserModel.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (user.two_factor_enabled) {
            return res.status(400).json({ error: 'Two-factor authentication is already enabled' });
        }
        const { secret, otpauthUrl } = generateTwoFactorSecret(user.email);
        const updatedUser = await UserModel.saveTwoFactorSecret(user.id, secret);
        res.json({
            secret,
            otpauthUrl,
            user: buildUserResponse(updatedUser),
        });
    }
    catch (error) {
        console.error('Error preparing 2FA setup:', error);
        res.status(500).json({ error: 'Failed to start 2FA setup' });
    }
});
router.post('/2fa/verify', authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ error: 'Code is required' });
        }
        const user = await UserModel.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (!user.two_factor_secret) {
            return res.status(400).json({ error: 'Two-factor authentication has not been initiated' });
        }
        const isValid = verifyTwoFactorToken(user.two_factor_secret, code);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid verification code' });
        }
        const recoveryCodes = generateRecoveryCodes();
        const hashedCodes = recoveryCodes.map(hashRecoveryCode);
        const updatedUser = await UserModel.enableTwoFactor(user.id, user.two_factor_secret, hashedCodes);
        res.json({
            enabled: true,
            recoveryCodes,
            user: buildUserResponse(updatedUser),
        });
    }
    catch (error) {
        console.error('Error verifying 2FA code:', error);
        res.status(500).json({ error: 'Failed to verify 2FA code' });
    }
});
router.post('/2fa/challenge', async (req, res) => {
    try {
        const { pendingToken, code, recoveryCode } = req.body;
        if (!pendingToken) {
            return res.status(400).json({ error: 'Pending token is required' });
        }
        let decoded;
        try {
            decoded = jwt.verify(pendingToken, JWT_SECRET);
        }
        catch (error) {
            if (error instanceof jwt.JsonWebTokenError) {
                return res.status(401).json({ error: 'Invalid or expired pending token' });
            }
            throw error;
        }
        if (!decoded.twoFactorPending) {
            return res.status(400).json({ error: 'Invalid pending token' });
        }
        let user = await UserModel.findById(decoded.userId);
        if (!user || !user.two_factor_enabled || !user.two_factor_secret) {
            return res.status(401).json({ error: 'Two-factor authentication is not enabled for this user' });
        }
        if (!code && !recoveryCode) {
            return res.status(400).json({ error: 'A verification code or recovery code is required' });
        }
        let recoveryCodeUsed = false;
        if (code) {
            const isValid = verifyTwoFactorToken(user.two_factor_secret, code);
            if (!isValid) {
                return res.status(401).json({ error: 'Invalid verification code' });
            }
        }
        else if (recoveryCode) {
            const result = verifyRecoveryCode(user.two_factor_recovery_codes ?? [], recoveryCode);
            if (!result.valid) {
                return res.status(401).json({ error: 'Invalid recovery code' });
            }
            recoveryCodeUsed = true;
            user = await UserModel.updateRecoveryCodes(user.id, result.remaining);
        }
        const sessionToken = createSessionToken(user);
        // Record login session
        try {
            await LoginSessionModel.create(user.id);
        }
        catch (error) {
            // Log error but don't fail the login
            console.error('Error recording login session:', error);
        }
        res.json({
            token: sessionToken,
            user: buildUserResponse(user),
            recoveryCodeUsed,
            recoveryCodesRemaining: user.two_factor_recovery_codes?.length ?? 0,
        });
    }
    catch (error) {
        console.error('Error processing 2FA challenge:', error);
        res.status(500).json({ error: 'Failed to process 2FA challenge' });
    }
});
router.delete('/2fa', authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { code, recoveryCode } = req.body;
        if (!code && !recoveryCode) {
            return res.status(400).json({ error: 'A verification code or recovery code is required' });
        }
        const user = await UserModel.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (!user.two_factor_enabled || !user.two_factor_secret) {
            return res.status(400).json({ error: 'Two-factor authentication is not enabled' });
        }
        if (code) {
            const isValid = verifyTwoFactorToken(user.two_factor_secret, code);
            if (!isValid) {
                return res.status(401).json({ error: 'Invalid verification code' });
            }
        }
        else if (recoveryCode) {
            const result = verifyRecoveryCode(user.two_factor_recovery_codes ?? [], recoveryCode);
            if (!result.valid) {
                return res.status(401).json({ error: 'Invalid recovery code' });
            }
        }
        const updatedUser = await UserModel.disableTwoFactor(user.id);
        res.json({
            success: true,
            user: buildUserResponse(updatedUser),
        });
    }
    catch (error) {
        console.error('Error disabling 2FA:', error);
        res.status(500).json({ error: 'Failed to disable 2FA' });
    }
});
router.get('/api-key', authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const user = await UserModel.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            hasKey: Boolean(user.api_key_hash),
            createdAt: user.api_key_created_at || null,
            lastUsedAt: user.api_key_last_used_at || null,
        });
    }
    catch (error) {
        console.error('Error fetching API key metadata:', error);
        res.status(500).json({ error: 'Failed to fetch API key information' });
    }
});
router.post('/api-key', authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const user = await UserModel.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const apiKey = generateApiKey();
        const apiKeyHash = hashApiKey(apiKey);
        const updatedUser = await UserModel.setApiKey(user.id, apiKeyHash);
        res.json({
            apiKey,
            createdAt: updatedUser.api_key_created_at,
            lastUsedAt: updatedUser.api_key_last_used_at,
        });
    }
    catch (error) {
        console.error('Error generating API key:', error);
        res.status(500).json({ error: 'Failed to generate API key' });
    }
});
router.delete('/api-key', authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const user = await UserModel.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        await UserModel.clearApiKey(user.id);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error revoking API key:', error);
        res.status(500).json({ error: 'Failed to revoke API key' });
    }
});
// Get login sessions history
router.get('/login-sessions', authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
        const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
        const sessions = await LoginSessionModel.findByUserId(req.user.id, limit, offset);
        const total = await LoginSessionModel.countByUserId(req.user.id);
        res.json({
            sessions,
            pagination: {
                limit,
                offset,
                total,
                hasMore: offset + sessions.length < total,
            },
        });
    }
    catch (error) {
        console.error('Error fetching login sessions:', error);
        res.status(500).json({ error: 'Failed to fetch login sessions' });
    }
});
// Get login streak for current week
router.get('/login-streak', authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const streak = await LoginSessionModel.getLoginStreak(req.user.id);
        res.json(streak);
    }
    catch (error) {
        console.error('Error fetching login streak:', error);
        res.status(500).json({ error: 'Failed to fetch login streak' });
    }
});
export default router;
//# sourceMappingURL=auth.js.map