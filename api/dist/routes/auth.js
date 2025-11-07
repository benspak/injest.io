import express from 'express';
import { UserModel } from '../models/User.js';
import { emailService } from '../services/email.js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN, FRONTEND_URL } from '../config/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { getXComOAuthService } from '../services/xcomOAuth.js';
import pool from '../config/database.js';
import crypto from 'crypto';
const router = express.Router();
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
        // Generate new JWT for authenticated session
        const sessionToken = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        res.json({
            token: sessionToken,
            user: {
                id: user.id,
                email: user.email,
                verified: user.verified,
                is_premium: user.is_premium || false,
            }
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
            user: {
                id: user.id,
                email: user.email,
                verified: user.verified,
                is_premium: user.is_premium || false,
            }
        });
    }
    catch (error) {
        console.error('Error getting current user:', error);
        res.status(500).json({ error: 'Failed to get current user' });
    }
});
/**
 * GET /api/auth/xcom/login
 * Initiate X.com OAuth login flow
 */
router.get('/xcom/login', async (req, res) => {
    try {
        const oauthService = getXComOAuthService();
        const codeVerifier = oauthService.generateCodeVerifier();
        const codeChallenge = oauthService.generateCodeChallenge(codeVerifier);
        const state = oauthService.generateState();
        // Generate session ID for login flow
        const sessionId = crypto.randomBytes(16).toString('hex');
        // Store verifier and state
        oauthService.storeLoginVerifier(sessionId, codeVerifier, state);
        // Generate login callback URL (use env var if set, otherwise construct from API_URL)
        const loginCallbackUrl = process.env.X_LOGIN_CALLBACK_URL || `${process.env.API_URL || 'http://localhost:5555'}/api/auth/xcom/callback`;
        // Generate authorization URL
        const authUrl = oauthService.getLoginAuthorizationUrl(sessionId, codeChallenge, state, loginCallbackUrl);
        // Store session ID in a cookie or return it to be stored client-side
        // For simplicity, we'll include it in the state
        res.redirect(authUrl);
    }
    catch (error) {
        console.error('Error initiating X.com login:', error);
        res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(error.message || 'xcom_login_failed')}`);
    }
});
/**
 * GET /api/auth/xcom/callback
 * Handle X.com OAuth login callback
 */
router.get('/xcom/callback', async (req, res) => {
    try {
        const { code, state, error } = req.query;
        if (error) {
            return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(error)}`);
        }
        if (!code || !state) {
            return res.redirect(`${FRONTEND_URL}/login?error=missing_code_or_state`);
        }
        // Decode state to get sessionId and nonce
        const oauthService = getXComOAuthService();
        let stateData;
        try {
            stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        }
        catch {
            return res.redirect(`${FRONTEND_URL}/login?error=invalid_state`);
        }
        if (stateData.type !== 'login' || !stateData.sessionId || !stateData.nonce) {
            return res.redirect(`${FRONTEND_URL}/login?error=invalid_state`);
        }
        const { sessionId, nonce } = stateData;
        const codeVerifier = oauthService.retrieveLoginVerifier(sessionId, nonce);
        if (!codeVerifier) {
            return res.redirect(`${FRONTEND_URL}/login?error=expired_or_invalid_verifier`);
        }
        // Exchange code for tokens (use same callback URL as authorization)
        const loginCallbackUrl = process.env.X_LOGIN_CALLBACK_URL || `${process.env.API_URL || 'http://localhost:5555'}/api/auth/xcom/callback`;
        let tokens;
        try {
            tokens = await oauthService.exchangeCodeForTokens(code, codeVerifier, loginCallbackUrl);
        }
        catch (error) {
            console.error('Error exchanging code for tokens:', error);
            return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(error.message || 'Failed to exchange code for tokens')}`);
        }
        // Get user info from X.com
        let userInfo;
        try {
            userInfo = await oauthService.getUserInfo(tokens.access_token);
        }
        catch (error) {
            console.error('Error getting user info from X.com:', error);
            console.error('Access token (first 20 chars):', tokens.access_token?.substring(0, 20));
            return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(error.message || 'Failed to get user info')}`);
        }
        // Find or create user by X.com user ID
        // Try to find by X.com user ID in the xcom_user_id field
        const userResult = await pool.query('SELECT * FROM users WHERE xcom_user_id = $1', [userInfo.id]);
        let user;
        if (userResult.rows.length > 0) {
            user = userResult.rows[0];
            // Update tokens if they exist
            await UserModel.updateXComTokens(user.id, {
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_in: tokens.expires_in,
                user_id: userInfo.id,
                username: userInfo.username,
            });
        }
        else {
            // Create new user with X.com username as email placeholder
            // In production, you might want to request email scope or use a different approach
            const email = `${userInfo.username}@x.com`; // Placeholder email
            user = await UserModel.create(email);
            // Update with X.com info
            await UserModel.updateXComTokens(user.id, {
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_in: tokens.expires_in,
                user_id: userInfo.id,
                username: userInfo.username,
            });
            // Auto-verify users who login via X.com
            await UserModel.verifyEmail(user.id);
        }
        // Generate JWT for authenticated session
        const sessionToken = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        // Redirect to frontend with token
        res.redirect(`${FRONTEND_URL}/auth/verify?token=${sessionToken}`);
    }
    catch (error) {
        console.error('Error handling X.com login callback:', error);
        res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(error.message || 'xcom_login_failed')}`);
    }
});
export default router;
//# sourceMappingURL=auth.js.map