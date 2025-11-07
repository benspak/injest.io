import express from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { getXComService, getXComServiceForUser } from '../services/xcom.js';
import { getXComOAuthService } from '../services/xcomOAuth.js';
import { UserModel } from '../models/User.js';
import { FRONTEND_URL } from '../config/auth.js';
import multer from 'multer';

const router = express.Router();

/**
 * GET /api/xcom/auth
 * Initiate OAuth 2.0 PKCE flow
 */
router.get('/auth', authMiddleware, async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const oauthService = getXComOAuthService();
    const codeVerifier = oauthService.generateCodeVerifier();
    const codeChallenge = oauthService.generateCodeChallenge(codeVerifier);
    const state = oauthService.generateState();

    // Store verifier and state
    oauthService.storeCodeVerifier(req.user.id, codeVerifier, state);

    // Generate authorization URL
    const authUrl = oauthService.getAuthorizationUrl(req.user.id, codeChallenge, state);

    res.redirect(authUrl);
  } catch (error: any) {
    console.error('Error initiating X.com OAuth:', error);
    res.status(500).json({
      error: 'Failed to initiate X.com authentication',
      details: error.message || 'Unknown error',
    });
  }
});

/**
 * GET /api/xcom/callback
 * Handle OAuth callback from X.com
 */
router.get('/callback', async (req: express.Request, res: express.Response) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`${FRONTEND_URL}/dashboard?xcom_error=${encodeURIComponent(error as string)}`);
    }

    if (!code || !state) {
      return res.redirect(`${FRONTEND_URL}/dashboard?xcom_error=missing_code_or_state`);
    }

    // Decode state to get userId and nonce
    const oauthService = getXComOAuthService();
    const stateData = oauthService.decodeState(state as string);

    if (!stateData) {
      return res.redirect(`${FRONTEND_URL}/dashboard?xcom_error=invalid_state`);
    }

    const { userId, nonce } = stateData;
    const codeVerifier = oauthService.retrieveCodeVerifier(userId, nonce);

    if (!codeVerifier) {
      return res.redirect(`${FRONTEND_URL}/dashboard?xcom_error=expired_or_invalid_verifier`);
    }

    // Exchange code for tokens
    const tokens = await oauthService.exchangeCodeForTokens(code as string, codeVerifier);

    // Get user info
    const userInfo = await oauthService.getUserInfo(tokens.access_token);

    // Store tokens in database
    await UserModel.updateXComTokens(userId, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      user_id: userInfo.id,
      username: userInfo.username,
    });

    res.redirect(`${FRONTEND_URL}/dashboard?xcom_connected=true&username=${encodeURIComponent(userInfo.username)}`);
  } catch (error: any) {
    console.error('Error handling X.com OAuth callback:', error);
    res.redirect(`${FRONTEND_URL}/dashboard?xcom_error=${encodeURIComponent(error.message || 'authentication_failed')}`);
  }
});

/**
 * GET /api/xcom/status
 * Check if user has connected X.com
 */
router.get('/status', authMiddleware, async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const tokens = await UserModel.getXComTokens(req.user.id);

    if (!tokens || !tokens.access_token) {
      return res.json({
        connected: false,
      });
    }

    res.json({
      connected: true,
      username: tokens.username,
      user_id: tokens.user_id,
    });
  } catch (error: any) {
    console.error('Error checking X.com status:', error);
    res.status(500).json({
      error: 'Failed to check X.com connection status',
      details: error.message || 'Unknown error',
    });
  }
});

/**
 * POST /api/xcom/disconnect
 * Disconnect X.com account
 */
router.post('/disconnect', authMiddleware, async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const tokens = await UserModel.getXComTokens(req.user.id);

    if (tokens && tokens.access_token) {
      try {
        const oauthService = getXComOAuthService();
        // Try to revoke access token
        if (tokens.access_token) {
          await oauthService.revokeToken(tokens.access_token, 'access_token');
        }
        // Try to revoke refresh token if available
        if (tokens.refresh_token) {
          await oauthService.revokeToken(tokens.refresh_token, 'refresh_token');
        }
      } catch (revokeError) {
        // Log but don't fail - tokens may already be revoked
        console.warn('Error revoking X.com tokens:', revokeError);
      }
    }

    // Clear tokens from database
    await UserModel.clearXComTokens(req.user.id);

    res.json({
      success: true,
      message: 'X.com account disconnected',
    });
  } catch (error: any) {
    console.error('Error disconnecting X.com:', error);
    res.status(500).json({
      error: 'Failed to disconnect X.com account',
      details: error.message || 'Unknown error',
    });
  }
});

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for images
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

/**
 * POST /api/xcom/post
 * Post an image with description to X.com
 * Uses user's OAuth tokens if available, falls back to static credentials
 */
router.post(
  '/post',
  authMiddleware,
  upload.single('image'),
  async (req: AuthRequest, res: express.Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { description } = req.body;
      const image = req.file;

      if (!description || !description.trim()) {
        return res.status(400).json({ error: 'Description is required' });
      }

      if (!image) {
        return res.status(400).json({ error: 'Image file is required' });
      }

      // Get user's tokens
      const userTokens = await UserModel.getXComTokens(req.user.id);

      // Get service instance for user (handles token refresh if needed)
      const xcomService = await getXComServiceForUser(
        req.user.id,
        userTokens,
        async (refreshedTokens) => {
          // Update tokens in database when refreshed
          await UserModel.updateXComTokens(req.user!.id, {
            access_token: refreshedTokens.access_token,
            refresh_token: refreshedTokens.refresh_token,
            expires_in: refreshedTokens.expires_in,
          });
        }
      );

      // Upload media to X.com
      const mediaId = await xcomService.uploadMedia(image.buffer, image.mimetype);

      // Create post with description and media
      const result = await xcomService.createPost(description.trim(), mediaId);

      res.json({
        success: true,
        postId: result.data.id,
        text: result.data.text,
      });
    } catch (error: any) {
      console.error('Error posting to X.com:', error);
      res.status(500).json({
        error: 'Failed to post to X.com',
        details: error.message || 'Unknown error',
      });
    }
  }
);

export default router;
