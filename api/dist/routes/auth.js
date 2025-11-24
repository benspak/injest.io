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
import { hashPassword, verifyPassword } from '../utils/passwords.js';
import { generateTwoFactorSecret, verifyTwoFactorToken, generateRecoveryCodes, hashRecoveryCode, verifyRecoveryCode, } from '../services/twoFactor.js';
import { ReferralService } from '../services/referral.js';
const router = express.Router();
const TWO_FACTOR_PENDING_EXPIRATION = '10m';
const PASSWORD_RESET_EXPIRATION = '1h'; // Password reset tokens expire in 1 hour
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
        recovery_email: user.recovery_email || null,
    };
}
// Reserved usernames that cannot be used
const RESERVED_USERNAMES = ['admin', 'api', 'settings', 'profile', 'profiles', 'auth', 'login', 'logout', 'signup', 'signin', 'noreply', 'no-reply', 'support', 'info', 'postmaster'];
// Validate username format
function validateUsername(username) {
    if (!username || username.trim().length === 0) {
        return { valid: false, error: 'Username is required' };
    }
    const trimmed = username.trim().toLowerCase();
    if (trimmed.length < 3) {
        return { valid: false, error: 'Username must be at least 3 characters' };
    }
    if (trimmed.length > 30) {
        return { valid: false, error: 'Username must be at most 30 characters' };
    }
    if (!/^[a-z0-9._-]+$/.test(trimmed)) {
        return { valid: false, error: 'Username can only contain letters, numbers, dots, hyphens, and underscores' };
    }
    if (RESERVED_USERNAMES.includes(trimmed)) {
        return { valid: false, error: 'This username is reserved and cannot be used' };
    }
    return { valid: true };
}
// Validate password with stronger requirements
function validatePassword(password) {
    if (!password || password.length === 0) {
        return { valid: false, error: 'Password is required' };
    }
    if (password.length < 8) {
        return { valid: false, error: 'Password must be at least 8 characters' };
    }
    // Check for password complexity
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    const complexityCount = [hasUpperCase, hasLowerCase, hasNumber, hasSpecialChar].filter(Boolean).length;
    // Require at least 3 out of 4 complexity requirements
    if (complexityCount < 3) {
        return {
            valid: false,
            error: 'Password must contain at least 3 of the following: uppercase letter, lowercase letter, number, special character'
        };
    }
    return { valid: true };
}
// Validate email format
function validateEmail(email) {
    if (!email || email.trim().length === 0) {
        return { valid: false, error: 'Email is required' };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
        return { valid: false, error: 'Invalid email format' };
    }
    return { valid: true };
}
// Signup endpoint
router.post('/signup', async (req, res) => {
    try {
        const { username, password, recovery_email, first_name, last_name, date_of_birth, headline, bio, company, project_title, project_description, zip_code, x_profile_url, youtube_url, github_url, linkedin_url, referral_code, } = req.body;
        // Validate required fields
        const usernameValidation = validateUsername(username);
        if (!usernameValidation.valid) {
            return res.status(400).json({ error: usernameValidation.error });
        }
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.error });
        }
        const recoveryEmailValidation = validateEmail(recovery_email);
        if (!recoveryEmailValidation.valid) {
            return res.status(400).json({ error: recoveryEmailValidation.error });
        }
        if (!first_name || first_name.trim().length === 0) {
            return res.status(400).json({ error: 'First name is required' });
        }
        if (!last_name || last_name.trim().length === 0) {
            return res.status(400).json({ error: 'Last name is required' });
        }
        // Validate date of birth and age requirement
        if (!date_of_birth) {
            return res.status(400).json({ error: 'Date of birth is required' });
        }
        const dob = new Date(date_of_birth);
        if (isNaN(dob.getTime())) {
            return res.status(400).json({ error: 'Invalid date of birth format' });
        }
        // Calculate age
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
            age--;
        }
        if (age < 18) {
            return res.status(400).json({ error: 'You must be at least 18 years old to use this service' });
        }
        // Check if username is already taken
        const trimmedUsername = username.trim().toLowerCase();
        const existingUser = await UserModel.findByPublicUsername(trimmedUsername);
        if (existingUser) {
            return res.status(409).json({ error: 'Username is already taken' });
        }
        // Check if recovery email is different from primary email
        const primaryEmail = `${trimmedUsername}@injest.io`;
        if (recovery_email.trim().toLowerCase() === primaryEmail.toLowerCase()) {
            return res.status(400).json({ error: 'Recovery email must be different from your primary email' });
        }
        // Hash password
        const passwordHash = await hashPassword(password);
        // Create user
        const user = await UserModel.createWithPassword(primaryEmail, passwordHash, recovery_email.trim().toLowerCase(), {
            public_username: trimmedUsername,
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            date_of_birth: dob,
            headline: headline?.trim(),
            bio: bio?.trim(),
            company: company?.trim(),
            project_title: project_title?.trim(),
            project_description: project_description?.trim(),
            zip_code: zip_code?.trim(),
            x_profile_url: x_profile_url?.trim(),
            youtube_url: youtube_url?.trim(),
            github_url: github_url?.trim(),
            linkedin_url: linkedin_url?.trim(),
        });
        await ItemAccessModel.linkUserToEmail(user.id, user.email);
        // Handle referral code if provided
        if (referral_code && typeof referral_code === 'string') {
            try {
                await ReferralService.createReferral(referral_code.trim(), user.id);
            }
            catch (error) {
                // Log error but don't fail signup if referral code is invalid
                console.error('Error processing referral code:', error);
            }
        }
        // Create session token
        const sessionToken = createSessionToken(user);
        // Record login session
        try {
            await LoginSessionModel.create(user.id);
        }
        catch (error) {
            console.error('Error recording login session:', error);
        }
        // Send welcome email
        try {
            await emailService.sendApprovalEmail(user.email);
        }
        catch (error) {
            console.error('Error sending welcome email:', error);
        }
        res.status(201).json({
            token: sessionToken,
            user: buildUserResponse(user),
        });
    }
    catch (error) {
        console.error('Error during signup:', error);
        res.status(500).json({ error: 'Failed to create account' });
    }
});
// Login endpoint
router.post('/login', async (req, res) => {
    try {
        const { usernameOrEmail, password } = req.body;
        if (!usernameOrEmail || !password) {
            return res.status(400).json({ error: 'Username/email and password are required' });
        }
        // Find user by username or email
        const user = await UserModel.findByUsernameOrEmail(usernameOrEmail.trim());
        if (!user) {
            return res.status(401).json({ error: 'Invalid username/email or password' });
        }
        // Check if user has a password (migrated users might not have one yet)
        if (!user.password_hash) {
            return res.status(401).json({ error: 'Account not set up. Please contact support.' });
        }
        // Verify password
        const isValid = await verifyPassword(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid username/email or password' });
        }
        const responseUser = buildUserResponse(user);
        // Check for 2FA
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
            console.error('Error recording login session:', error);
        }
        res.json({
            token: sessionToken,
            user: responseUser,
        });
    }
    catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
});
// Forgot password endpoint
router.post('/forgot-password', async (req, res) => {
    try {
        const { usernameOrEmail } = req.body;
        if (!usernameOrEmail) {
            return res.status(400).json({ error: 'Username or email is required' });
        }
        // Find user by username or email
        const user = await UserModel.findByUsernameOrEmail(usernameOrEmail.trim());
        if (!user) {
            // Don't reveal if user exists - return success anyway for security
            return res.json({ message: 'If an account exists with that username/email, a password reset link has been sent.' });
        }
        // Generate password reset token
        const resetToken = jwt.sign({ userId: user.id, email: user.email, passwordReset: true }, JWT_SECRET, { expiresIn: PASSWORD_RESET_EXPIRATION });
        // Send password reset email
        const resetLink = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;
        // Use recovery email if available, otherwise use primary email
        const emailToSend = user.recovery_email || user.email;
        try {
            await emailService.sendPasswordResetEmail(emailToSend, resetLink, user.email);
        }
        catch (error) {
            console.error('Error sending password reset email:', error);
            // Still return success to avoid revealing if user exists
        }
        res.json({ message: 'If an account exists with that username/email, a password reset link has been sent.' });
    }
    catch (error) {
        console.error('Error processing forgot password request:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
});
// Reset password endpoint
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) {
            return res.status(400).json({ error: 'Token and password are required' });
        }
        // Validate password
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.error });
        }
        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        }
        catch (error) {
            if (error instanceof jwt.JsonWebTokenError) {
                return res.status(401).json({ error: 'Invalid or expired reset token' });
            }
            throw error;
        }
        if (!decoded.passwordReset) {
            return res.status(400).json({ error: 'Invalid reset token' });
        }
        // Find user
        const user = await UserModel.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Hash new password
        const passwordHash = await hashPassword(password);
        // Update user password
        await UserModel.setPassword(user.id, passwordHash);
        res.json({ message: 'Password has been reset successfully' });
    }
    catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ error: 'Failed to reset password' });
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