import express from 'express';
import { UserModel } from '../models/User.js';
import { emailService } from '../services/email.js';
import jwt, { SignOptions } from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN, FRONTEND_URL } from '../config/auth.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { getXComOAuthService } from '../services/xcomOAuth.js';
import pool from '../config/database.js';
import crypto from 'crypto';

const router = express.Router();

// Send magic link
router.post('/magic-link', async (req: express.Request, res: express.Response) => {
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
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as SignOptions
    );

    // Send magic link email
    const magicLink = `${FRONTEND_URL}/auth/verify?token=${token}`;
    await emailService.sendMagicLink(email, magicLink);

    res.json({ message: 'Magic link sent to your email' });
  } catch (error) {
    console.error('Error sending magic link:', error);
    res.status(500).json({ error: 'Failed to send magic link' });
  }
});

// Verify magic link token
router.get('/verify', async (req: express.Request, res: express.Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token is required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };

    // Get user before verification
    const userBefore = await UserModel.findById(decoded.userId);

    // Verify user email
    const user = await UserModel.verifyEmail(decoded.userId);

    // Send approval email if this is the first verification
    if (userBefore && !userBefore.verified && user.verified) {
      await emailService.sendApprovalEmail(user.email);
    }

    // Generate new JWT for authenticated session
    const sessionToken = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as SignOptions
    );

    res.json({
      token: sessionToken,
      user: {
        id: user.id,
        email: user.email,
        verified: user.verified,
        is_premium: user.is_premium || false,
      }
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    console.error('Error verifying token:', error);
    res.status(500).json({ error: 'Failed to verify token' });
  }
});

// Get current user (requires auth middleware)
router.get('/me', authMiddleware, async (req: AuthRequest, res: express.Response) => {
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
  } catch (error) {
    console.error('Error getting current user:', error);
    res.status(500).json({ error: 'Failed to get current user' });
  }
});

/**
 * GET /api/auth/xcom/login
 * Initiate X.com OAuth login flow
 */
router.get('/xcom/login', async (req: express.Request, res: express.Response) => {
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
  } catch (error: any) {
    console.error('Error initiating X.com login:', error);
    res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(error.message || 'xcom_login_failed')}`);
  }
});

/**
 * GET /api/auth/xcom/callback
 * Handle X.com OAuth login callback
 */
router.get('/xcom/callback', async (req: express.Request, res: express.Response) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(error as string)}`);
    }

    if (!code || !state) {
      return res.redirect(`${FRONTEND_URL}/login?error=missing_code_or_state`);
    }

    // Decode state to get sessionId and nonce
    const oauthService = getXComOAuthService();
    let stateData: { sessionId?: string; nonce?: string; type?: string };
    try {
      stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    } catch {
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
      tokens = await oauthService.exchangeCodeForTokens(code as string, codeVerifier, loginCallbackUrl);
    } catch (error: any) {
      console.error('Error exchanging code for tokens:', error);
      return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(error.message || 'Failed to exchange code for tokens')}`);
    }

    // Get user info from X.com
    let userInfo;
    try {
      userInfo = await oauthService.getUserInfo(tokens.access_token);
    } catch (error: any) {
      console.error('Error getting user info from X.com:', error);
      console.error('Access token (first 20 chars):', tokens.access_token?.substring(0, 20));
      return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(error.message || 'Failed to get user info')}`);
    }

    // Find or create user by X.com user ID
    // Try to find by X.com user ID in the xcom_user_id field
    const userResult = await pool.query('SELECT * FROM users WHERE xcom_user_id = $1', [userInfo.id]);

    let user;
    if (userResult.rows.length > 0) {
      // User already exists with this X.com account
      user = userResult.rows[0];
      // Update tokens if they exist
      await UserModel.updateXComTokens(user.id, {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        user_id: userInfo.id,
        username: userInfo.username,
      });

      // Generate JWT for authenticated session
      const sessionToken = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN } as SignOptions
      );

      // Redirect to frontend with token
      res.redirect(`${FRONTEND_URL}/auth/verify?token=${sessionToken}`);
    } else {
      // New X.com login - check if user wants to link to existing account
      // Store X.com tokens temporarily and redirect to linking page
      const linkId = crypto.randomBytes(16).toString('hex');
      oauthService.storePendingXComLink(linkId, tokens, userInfo);

      // Redirect to frontend linking page
      res.redirect(`${FRONTEND_URL}/auth/xcom-link?linkId=${linkId}&username=${encodeURIComponent(userInfo.username)}`);
    }
  } catch (error: any) {
    console.error('Error handling X.com login callback:', error);
    res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(error.message || 'xcom_login_failed')}`);
  }
});

/**
 * POST /api/auth/xcom/link
 * Link X.com account to existing email account
 * Sends a magic link to the email to verify and link accounts
 */
router.post('/xcom/link', async (req: express.Request, res: express.Response) => {
  try {
    const { linkId, email } = req.body;

    if (!linkId || !email) {
      return res.status(400).json({ error: 'Link ID and email are required' });
    }

    const oauthService = getXComOAuthService();
    const pendingLink = oauthService.retrievePendingXComLink(linkId);

    if (!pendingLink) {
      return res.status(400).json({ error: 'Invalid or expired link ID' });
    }

    // Check if account with this email exists
    const existingUser = await UserModel.findByEmail(email);

    if (!existingUser) {
      return res.status(404).json({ error: 'No account found with this email address' });
    }

    // Check if this X.com account is already linked to another user
    const existingXComUser = await pool.query(
      'SELECT * FROM users WHERE xcom_user_id = $1 AND id != $2',
      [pendingLink.user_id, existingUser.id]
    );

    if (existingXComUser.rows.length > 0) {
      return res.status(400).json({ error: 'This X.com account is already linked to another account' });
    }

    // Send magic link with linkId embedded in token for verification
    const linkToken = jwt.sign(
      {
        userId: existingUser.id,
        email: existingUser.email,
        linkId,
        xcomUserId: pendingLink.user_id,
      },
      JWT_SECRET,
      { expiresIn: '15m' } as SignOptions
    );

    // Store pending link data again with the linkToken as key (in case email takes time)
    oauthService.storePendingXComLink(linkToken, {
      access_token: pendingLink.access_token,
      refresh_token: pendingLink.refresh_token,
      expires_in: pendingLink.expires_in,
    }, {
      id: pendingLink.user_id,
      username: pendingLink.username,
    });

    const magicLink = `${FRONTEND_URL}/auth/xcom-verify-link?token=${linkToken}`;
    await emailService.sendMagicLink(email, magicLink);

    res.json({
      message: 'Verification email sent. Please check your email to complete linking your X.com account.',
    });
  } catch (error: any) {
    console.error('Error linking X.com account:', error);
    res.status(500).json({ error: 'Failed to link X.com account', details: error.message });
  }
});

/**
 * GET /api/auth/xcom-verify-link
 * Verify and complete linking X.com account to existing account
 */
router.get('/xcom-verify-link', async (req: express.Request, res: express.Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.redirect(`${FRONTEND_URL}/login?error=invalid_token`);
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
      linkId?: string;
      xcomUserId?: string;
    };

    if (!decoded.linkId && !decoded.xcomUserId) {
      // Regular magic link token, not for X.com linking
      return res.redirect(`${FRONTEND_URL}/auth/verify?token=${token}`);
    }

    const oauthService = getXComOAuthService();
    const pendingLink = oauthService.retrievePendingXComLink(token);

    if (!pendingLink) {
      return res.redirect(`${FRONTEND_URL}/login?error=expired_link`);
    }

    // Get the user
    const user = await UserModel.findById(decoded.userId);
    if (!user) {
      return res.redirect(`${FRONTEND_URL}/login?error=user_not_found`);
    }

    // Verify email if not already verified
    if (!user.verified) {
      await UserModel.verifyEmail(user.id);
    }

    // Link X.com account to this user
    await UserModel.updateXComTokens(user.id, {
      access_token: pendingLink.access_token,
      refresh_token: pendingLink.refresh_token,
      expires_in: pendingLink.expires_in,
      user_id: pendingLink.user_id,
      username: pendingLink.username,
    });

    // Generate JWT for authenticated session
    const sessionToken = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as SignOptions
    );

    // Redirect to verify page to set token, then dashboard
    res.redirect(`${FRONTEND_URL}/auth/verify?token=${sessionToken}&xcom_linked=true&username=${encodeURIComponent(pendingLink.username)}`);
  } catch (error: any) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.redirect(`${FRONTEND_URL}/login?error=invalid_or_expired_token`);
    }
    console.error('Error verifying X.com link:', error);
    res.redirect(`${FRONTEND_URL}/login?error=verification_failed`);
  }
});

/**
 * POST /api/auth/xcom/create-account
 * Create a new account with X.com login (skip email linking)
 */
router.post('/xcom/create-account', async (req: express.Request, res: express.Response) => {
  try {
    const { linkId } = req.body;

    if (!linkId) {
      return res.status(400).json({ error: 'Link ID is required' });
    }

    const oauthService = getXComOAuthService();
    const pendingLink = oauthService.retrievePendingXComLink(linkId);

    if (!pendingLink) {
      return res.status(400).json({ error: 'Invalid or expired link ID' });
    }

    // Check if this X.com account is already linked
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE xcom_user_id = $1',
      [pendingLink.user_id]
    );

    if (existingUser.rows.length > 0) {
      // Account already exists, just log them in
      const user = existingUser.rows[0];
      await UserModel.updateXComTokens(user.id, {
        access_token: pendingLink.access_token,
        refresh_token: pendingLink.refresh_token,
        expires_in: pendingLink.expires_in,
        user_id: pendingLink.user_id,
        username: pendingLink.username,
      });

      const sessionToken = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN } as SignOptions
      );

      return res.json({ token: sessionToken });
    }

    // Create new user with X.com username as email placeholder
    const email = `${pendingLink.username}@x.com`;
    const user = await UserModel.create(email);

    // Update with X.com info
    await UserModel.updateXComTokens(user.id, {
      access_token: pendingLink.access_token,
      refresh_token: pendingLink.refresh_token,
      expires_in: pendingLink.expires_in,
      user_id: pendingLink.user_id,
      username: pendingLink.username,
    });

    // Auto-verify users who login via X.com
    await UserModel.verifyEmail(user.id);

    // Generate JWT for authenticated session
    const sessionToken = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as SignOptions
    );

    res.json({ token: sessionToken });
  } catch (error: any) {
    console.error('Error creating account with X.com:', error);
    res.status(500).json({ error: 'Failed to create account', details: error.message });
  }
});

export default router;
