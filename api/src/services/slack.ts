import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { JWT_SECRET, API_URL } from '../config/auth.js';

dotenv.config();

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;

// Use SLACK_REDIRECT_URI if explicitly set, otherwise construct from API_URL
const getRedirectUri = (): string => {
  if (process.env.SLACK_REDIRECT_URI) {
    console.log('[Slack] Using SLACK_REDIRECT_URI from environment:', process.env.SLACK_REDIRECT_URI);
    return process.env.SLACK_REDIRECT_URI;
  }
  const baseUrl = API_URL.replace(/\/$/, ''); // Remove trailing slash
  // If API_URL already ends with /api, don't add it again
  let redirectUri: string;
  if (baseUrl.endsWith('/api')) {
    redirectUri = `${baseUrl}/slack/oauth/callback`;
  } else {
    redirectUri = `${baseUrl}/api/slack/oauth/callback`;
  }
  console.log('[Slack] Constructed redirect URI from API_URL:', {
    API_URL,
    baseUrl,
    redirectUri,
  });
  return redirectUri;
};
const SLACK_REDIRECT_URI = getRedirectUri();
const SLACK_API_BASE_URL = 'https://slack.com/api';
const SLACK_AUTH_BASE_URL = 'https://slack.com/oauth/v2/authorize';

interface OAuthState {
  userId: string;
  state: string; // Random state for CSRF protection
}

interface SlackTokenResponse {
  ok: boolean;
  access_token?: string;
  token_type?: string;
  scope?: string;
  bot_user_id?: string;
  app_id?: string;
  team?: {
    id: string;
    name: string;
  };
  authed_user?: {
    id: string;
    scope?: string;
    access_token?: string;
    token_type?: string;
  };
  error?: string;
}

interface SlackUserResponse {
  ok: boolean;
  user?: {
    id: string;
    name: string;
    real_name?: string;
    email?: string;
  };
  error?: string;
}

interface SlackTeamResponse {
  ok: boolean;
  team?: {
    id: string;
    name: string;
    domain?: string;
  };
  error?: string;
}

export class SlackService {
  /**
   * Generate a random state string for CSRF protection
   */
  private generateState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create a state token containing user ID and random state
   */
  private createStateToken(userId: string, state: string): string {
    const stateData: OAuthState = {
      userId,
      state,
    };
    // Increased expiration to 15 minutes to account for user delays
    return jwt.sign(stateData, JWT_SECRET, { expiresIn: '15m' });
  }

  /**
   * Verify and decode state token
   */
  private verifyStateToken(stateToken: string): OAuthState {
    try {
      if (!stateToken || typeof stateToken !== 'string') {
        throw new Error('State token is missing or invalid format');
      }
      const decoded = jwt.verify(stateToken, JWT_SECRET) as OAuthState;
      return decoded;
    } catch (error) {
      // Check for specific JWT error types
      if (error && typeof error === 'object') {
        // TokenExpiredError check
        if (error instanceof jwt.TokenExpiredError || (error as any).name === 'TokenExpiredError') {
          const expiredAt = (error as any).expiredAt;
          console.error('[Slack] State token expired:', expiredAt);
          throw new Error('State token has expired. Please try again.');
        }
        // JsonWebTokenError check (catches other JWT errors)
        if (error instanceof jwt.JsonWebTokenError || (error as any).name === 'JsonWebTokenError') {
          const message = error instanceof Error ? error.message : 'Invalid token';
          console.error('[Slack] Invalid state token:', message);
          throw new Error(`Invalid state token: ${message}`);
        }
      }
      // Generic error handling
      if (error instanceof Error) {
        console.error('[Slack] State token verification error:', error.message);
        throw error;
      }
      throw new Error('Invalid or expired state token');
    }
  }

  /**
   * Initiate OAuth 2.0 flow for linking account (requires userId)
   * Returns the authorization URL and state token
   */
  async initiateOAuth(userId: string): Promise<{ authUrl: string; state: string }> {
    if (!SLACK_CLIENT_ID) {
      throw new Error('SLACK_CLIENT_ID is not configured');
    }

    const randomState = this.generateState();
    const stateToken = this.createStateToken(userId, randomState);

    const scopes = [
      'channels:history',
      'channels:read',
      'groups:history',
      'groups:read',
      'im:history',
      'im:read',
      'mpim:history',
      'mpim:read',
      'files:read',
      'reactions:read',
      'chat:write',
      'commands',
      'users:read',
    ].join(',');

    const params = new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      scope: scopes,
      redirect_uri: SLACK_REDIRECT_URI,
      state: stateToken,
      user_scope: 'channels:history,groups:history,im:history,mpim:history',
    });

    const authUrl = `${SLACK_AUTH_BASE_URL}?${params.toString()}`;

    return { authUrl, state: stateToken };
  }

  /**
   * Handle OAuth callback and exchange authorization code for tokens
   */
  async handleCallback(
    code: string,
    state: string
  ): Promise<{ userId: string; workspaceId: string; workspaceName: string; botUserId: string }> {
    if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET) {
      throw new Error('Slack OAuth credentials are not configured');
    }

    if (!code || !state) {
      throw new Error('Missing authorization code or state parameter');
    }

    const stateData = this.verifyStateToken(state);
    const { userId } = stateData;

    // Exchange authorization code for access token
    const tokenResponse = await fetch(`${SLACK_API_BASE_URL}/oauth.v2.access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: SLACK_CLIENT_ID,
        client_secret: SLACK_CLIENT_SECRET,
        redirect_uri: SLACK_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[Slack] Token exchange failed:', errorText);
      throw new Error('Failed to exchange authorization code for tokens');
    }

    const tokenData = (await tokenResponse.json()) as SlackTokenResponse;

    if (!tokenData.ok || !tokenData.access_token) {
      console.error('[Slack] Token exchange error:', tokenData.error);
      throw new Error(tokenData.error || 'Failed to exchange authorization code for tokens');
    }

    const workspaceId = tokenData.team?.id;
    const workspaceName = tokenData.team?.name || 'Unknown Workspace';
    const botUserId = tokenData.bot_user_id || '';

    if (!workspaceId) {
      throw new Error('Workspace ID not found in token response');
    }

    // Import here to avoid circular dependency
    const { SlackOAuthTokenModel } = await import('../models/SlackOAuthToken.js');

    // Store or update tokens
    await SlackOAuthTokenModel.createOrUpdate(userId, {
      userId,
      workspaceId,
      accessToken: tokenData.access_token,
      botUserId,
      scope: tokenData.scope || null,
      authedUserId: tokenData.authed_user?.id || null,
      authedUserToken: tokenData.authed_user?.access_token || null,
    });

    return { userId, workspaceId, workspaceName, botUserId };
  }

  /**
   * Refresh access token using refresh token (if available)
   * Note: Slack tokens don't expire, but we'll implement this for consistency
   */
  async refreshToken(userId: string): Promise<void> {
    // Slack tokens don't typically expire, but we can verify they're still valid
    const { SlackOAuthTokenModel } = await import('../models/SlackOAuthToken.js');
    const token = await SlackOAuthTokenModel.findByUserId(userId);
    if (!token) {
      throw new Error('Slack OAuth token not found');
    }

    // Test token validity by making a simple API call
    const testResponse = await fetch(`${SLACK_API_BASE_URL}/auth.test`, {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
      },
    });

    if (!testResponse.ok) {
      const errorData = (await testResponse.json()) as { ok: boolean; error?: string };
      if (errorData.error === 'invalid_auth' || errorData.error === 'token_expired') {
        throw new Error('Slack token is invalid or expired. Please reconnect your Slack account.');
      }
      throw new Error(`Failed to verify token: ${errorData.error || 'Unknown error'}`);
    }
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  async getValidAccessToken(userId: string): Promise<string> {
    const { SlackOAuthTokenModel } = await import('../models/SlackOAuthToken.js');
    const token = await SlackOAuthTokenModel.findByUserId(userId);
    if (!token) {
      throw new Error('Slack OAuth token not found');
    }

    // Slack tokens don't expire, but verify they're still valid
    try {
      await this.refreshToken(userId);
    } catch (error) {
      console.error('[Slack] Failed to verify token:', error);
      throw new Error('Failed to verify Slack token. Please reconnect your Slack account.');
    }

    return token.access_token;
  }

  /**
   * Verify webhook request signature
   */
  verifyWebhookSignature(
    timestamp: string,
    signature: string,
    body: string
  ): boolean {
    if (!SLACK_SIGNING_SECRET) {
      throw new Error('SLACK_SIGNING_SECRET is not configured');
    }

    const hmac = crypto.createHmac('sha256', SLACK_SIGNING_SECRET);
    const [version, hash] = signature.split('=');
    if (version !== 'v0') {
      return false;
    }

    const baseString = `v0:${timestamp}:${body}`;
    const computedHash = hmac.update(baseString).digest('hex');

    // Use timing-safe comparison
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(computedHash));
  }

  /**
   * Check if user has connected Slack account
   */
  async isConnected(userId: string): Promise<boolean> {
    const { SlackOAuthTokenModel } = await import('../models/SlackOAuthToken.js');
    const token = await SlackOAuthTokenModel.findByUserId(userId);
    if (!token) {
      return false;
    }

    // Verify token is still valid
    try {
      await this.refreshToken(userId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Slack connection status
   */
  async getConnectionStatus(userId: string): Promise<{
    connected: boolean;
    workspaceId: string | null;
    workspaceName: string | null;
  }> {
    const { SlackOAuthTokenModel } = await import('../models/SlackOAuthToken.js');
    const token = await SlackOAuthTokenModel.findByUserId(userId);
    if (!token) {
      return { connected: false, workspaceId: null, workspaceName: null };
    }

    const isValid = await this.isConnected(userId);
    if (!isValid) {
      return { connected: false, workspaceId: null, workspaceName: null };
    }

    // Fetch workspace name if we have workspace ID
    let workspaceName: string | null = null;
    if (token.workspace_id) {
      try {
        const response = await fetch(`${SLACK_API_BASE_URL}/team.info`, {
          headers: {
            Authorization: `Bearer ${token.access_token}`,
          },
        });
        if (response.ok) {
          const data = (await response.json()) as SlackTeamResponse;
          if (data.ok && data.team) {
            workspaceName = data.team.name;
          }
        }
      } catch (error) {
        console.warn('[Slack] Failed to fetch workspace name:', error);
      }
    }

    return {
      connected: true,
      workspaceId: token.workspace_id,
      workspaceName,
    };
  }

  /**
   * Disconnect Slack account
   */
  async disconnect(userId: string): Promise<void> {
    const { SlackOAuthTokenModel } = await import('../models/SlackOAuthToken.js');
    await SlackOAuthTokenModel.delete(userId);
  }
}

export const slackService = new SlackService();
