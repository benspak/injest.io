import express from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { xcomService } from '../services/xcom.js';
import { FRONTEND_URL, JWT_SECRET, JWT_EXPIRES_IN } from '../config/auth.js';
import { UserModel } from '../models/User.js';
import jwt, { SignOptions } from 'jsonwebtoken';
import { ItemAccessModel } from '../models/ItemAccess.js';

const router = express.Router();

function createSessionToken(userId: string, email: string): string {
  return jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as SignOptions
  );
}

/**
 * Initiate X.com OAuth flow for login (public, no auth required)
 * GET /api/auth/xcom/login
 */
router.get('/login', async (req: express.Request, res: express.Response) => {
  try {
    const { authUrl } = await xcomService.initiateLoginOAuth();
    res.redirect(authUrl);
  } catch (error) {
    console.error('[X.com] Failed to initiate login OAuth:', error);
    res.redirect(`${FRONTEND_URL}/login?error=xcom_oauth_failed`);
  }
});

/**
 * Initiate X.com OAuth flow for linking account (requires auth)
 * GET /api/auth/xcom/initiate
 * Accepts token in Authorization header or as query parameter (for redirect flows)
 */
router.get('/initiate', async (req: express.Request, res: express.Response) => {
  try {
    // Try to get token from Authorization header first
    let token: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      // Fallback: get token from query parameter (for redirect flows)
      const tokenParam = req.query.token;
      if (tokenParam && typeof tokenParam === 'string') {
        token = tokenParam;
      }
    }

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify token and get user
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    const user = await UserModel.findById(decoded.userId);

    if (!user || !user.verified) {
      return res.status(401).json({ error: 'User not found or not verified' });
    }

    const { authUrl } = await xcomService.initiateOAuth(user.id);
    res.redirect(authUrl);
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    console.error('[X.com] Failed to initiate OAuth:', error);
    res.status(500).json({ error: 'Failed to initiate X.com OAuth flow' });
  }
});

/**
 * Handle X.com OAuth callback
 * GET /api/auth/xcom/callback
 */
router.get('/callback', async (req: express.Request, res: express.Response) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      console.error('[X.com] OAuth error:', error);
      // Try to determine if this is a login or link flow from state
      if (state && typeof state === 'string') {
        try {
          const decoded = jwt.verify(state, JWT_SECRET) as { mode?: string };
          if (decoded.mode === 'login') {
            return res.redirect(`${FRONTEND_URL}/login?error=xcom_oauth_denied`);
          }
        } catch (err) {
          console.warn('[X.com] Could not decode state for error redirect:', err);
          // State invalid, default to login
        }
      }
      return res.redirect(`${FRONTEND_URL}/login?error=xcom_oauth_denied`);
    }

    if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
      console.error('[X.com] Missing or invalid code/state:', {
        hasCode: !!code,
        codeType: typeof code,
        hasState: !!state,
        stateType: typeof state,
      });
      // Try to determine if this is a login or link flow
      if (state && typeof state === 'string') {
        try {
          const decoded = jwt.verify(state, JWT_SECRET) as { mode?: string };
          if (decoded.mode === 'login') {
            return res.redirect(`${FRONTEND_URL}/login?error=xcom_oauth_invalid`);
          }
        } catch (err) {
          console.warn('[X.com] Could not decode state for invalid redirect:', err);
          // State invalid, default to login
        }
      }
      return res.redirect(`${FRONTEND_URL}/login?error=xcom_oauth_invalid`);
    }

    const { userId, isNewUser } = await xcomService.handleCallback(code, state);

    // Get user to check mode from state token
    const decoded = jwt.verify(state, JWT_SECRET) as { mode?: string };
    const mode = decoded.mode || 'link';

    if (mode === 'login') {
      // Login flow: create session token and redirect to verify page
      const user = await UserModel.findById(userId);
      if (!user) {
        return res.redirect(`${FRONTEND_URL}/login?error=xcom_user_not_found`);
      }

      // Create session token
      const sessionToken = createSessionToken(user.id, user.email);

      // Redirect to auth verify page with token
      res.redirect(`${FRONTEND_URL}/auth/verify?token=${encodeURIComponent(sessionToken)}&xcom_login=true`);
    } else {
      // Link flow: redirect to settings page
      res.redirect(`${FRONTEND_URL}/settings?xcom_connected=true`);
    }
  } catch (error) {
    console.error('[X.com] Failed to handle OAuth callback:', error);
    if (error instanceof Error) {
      console.error('[X.com] Error details:', {
        message: error.message,
        stack: error.stack,
      });
    }
    // Try to determine if this is a login or link flow
    const stateParam = req.query.state;
    if (stateParam && typeof stateParam === 'string') {
      try {
        const decoded = jwt.verify(stateParam, JWT_SECRET) as { mode?: string };
        if (decoded.mode === 'login') {
          return res.redirect(`${FRONTEND_URL}/login?error=xcom_oauth_failed`);
        }
      } catch (err) {
        console.warn('[X.com] Could not decode state for error redirect:', err);
        // State invalid, default to login
      }
    }
    res.redirect(`${FRONTEND_URL}/login?error=xcom_oauth_failed`);
  }
});

/**
 * Get X.com connection status
 * GET /api/auth/xcom/status
 */
router.get('/status', authMiddleware, async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const status = await xcomService.getConnectionStatus(req.user.id);
    res.json(status);
  } catch (error) {
    console.error('[X.com] Failed to get connection status:', error);
    res.status(500).json({ error: 'Failed to get X.com connection status' });
  }
});

/**
 * Disconnect X.com account
 * POST /api/auth/xcom/disconnect
 */
router.post('/disconnect', authMiddleware, async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await xcomService.disconnect(req.user.id);
    res.json({ success: true });
  } catch (error) {
    console.error('[X.com] Failed to disconnect:', error);
    res.status(500).json({ error: 'Failed to disconnect X.com account' });
  }
});

export default router;
