import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { JWT_SECRET, API_URL } from '../config/auth.js';
import { XcomOAuthTokenModel, type XcomOAuthToken } from '../models/XcomOAuthToken.js';
import { UserModel } from '../models/User.js';
import { ItemAccessModel } from '../models/ItemAccess.js';

dotenv.config();

const X_CLIENT_ID = process.env.X_CLIENT_ID;
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET;
// Use X_REDIRECT_URI if explicitly set, otherwise construct from API_URL
const X_REDIRECT_URI = process.env.X_REDIRECT_URI || `${API_URL}/api/auth/xcom/callback`;
const X_API_BASE_URL = 'https://api.x.com';
const X_AUTH_BASE_URL = 'https://x.com';

interface OAuthState {
  userId?: string; // Optional for login flow
  codeVerifier: string;
  mode?: 'login' | 'link'; // 'login' for login page, 'link' for settings page
}

interface XcomTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

interface XcomUserResponse {
  data?: {
    id?: string;
    username?: string;
  };
}

interface XcomTweetResponse {
  data: {
    id: string;
    text: string;
  };
}

interface XcomErrorResponse {
  error?: {
    message?: string;
  };
  detail?: string;
}

export class XcomService {
  /**
   * Generate a random code verifier for PKCE
   */
  private generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Generate code challenge from code verifier
   */
  private generateCodeChallenge(codeVerifier: string): string {
    return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  }

  /**
   * Create a state token containing user ID and code verifier
   */
  private createStateToken(userId: string | undefined, codeVerifier: string, mode: 'login' | 'link' = 'link'): string {
    const state: OAuthState = {
      userId,
      codeVerifier,
      mode,
    };
    // Increased expiration to 15 minutes to account for user delays
    return jwt.sign(state, JWT_SECRET, { expiresIn: '15m' });
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
          console.error('[X.com] State token expired:', expiredAt);
          throw new Error('State token has expired. Please try again.');
        }
        // JsonWebTokenError check (catches other JWT errors)
        if (error instanceof jwt.JsonWebTokenError || (error as any).name === 'JsonWebTokenError') {
          const message = error instanceof Error ? error.message : 'Invalid token';
          console.error('[X.com] Invalid state token:', message);
          throw new Error(`Invalid state token: ${message}`);
        }
      }
      // Generic error handling
      if (error instanceof Error) {
        console.error('[X.com] State token verification error:', error.message);
        throw error;
      }
      throw new Error('Invalid or expired state token');
    }
  }

  /**
   * Initiate OAuth 2.0 PKCE flow for login (no userId required)
   * Returns the authorization URL and state token
   */
  async initiateLoginOAuth(): Promise<{ authUrl: string; state: string }> {
    if (!X_CLIENT_ID) {
      throw new Error('X_CLIENT_ID is not configured');
    }

    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    const state = this.createStateToken(undefined, codeVerifier, 'login');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: X_CLIENT_ID,
      redirect_uri: X_REDIRECT_URI,
      scope: 'tweet.read tweet.write users.read offline.access',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const authUrl = `${X_AUTH_BASE_URL}/i/oauth2/authorize?${params.toString()}`;

    return { authUrl, state };
  }

  /**
   * Initiate OAuth 2.0 PKCE flow for linking account (requires userId)
   * Returns the authorization URL and state token
   */
  async initiateOAuth(userId: string): Promise<{ authUrl: string; state: string }> {
    if (!X_CLIENT_ID) {
      throw new Error('X_CLIENT_ID is not configured');
    }

    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    const state = this.createStateToken(userId, codeVerifier, 'link');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: X_CLIENT_ID,
      redirect_uri: X_REDIRECT_URI,
      scope: 'tweet.read tweet.write users.read offline.access',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const authUrl = `${X_AUTH_BASE_URL}/i/oauth2/authorize?${params.toString()}`;

    return { authUrl, state };
  }

  /**
   * Handle OAuth callback and exchange authorization code for tokens
   * For login flow: creates user if doesn't exist, returns userId
   * For link flow: uses existing userId from state
   */
  async handleCallback(
    code: string,
    state: string
  ): Promise<{ userId: string; token: XcomOAuthToken; isNewUser?: boolean }> {
    if (!X_CLIENT_ID || !X_CLIENT_SECRET) {
      throw new Error('X.com OAuth credentials are not configured');
    }

    if (!code || !state) {
      throw new Error('Missing authorization code or state parameter');
    }

    console.log('[X.com] Handling OAuth callback with state length:', state?.length || 0);
    const stateData = this.verifyStateToken(state);
    const { userId, codeVerifier, mode } = stateData;

    // Exchange authorization code for access token
    const tokenResponse = await fetch(`${X_API_BASE_URL}/2/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: X_CLIENT_ID,
        redirect_uri: X_REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[X.com] Token exchange failed:', errorText);
      throw new Error('Failed to exchange authorization code for tokens');
    }

    const tokenData = (await tokenResponse.json()) as XcomTokenResponse;

    // Get user information
    let xUserId: string | null = null;
    let xUsername: string | null = null;

    try {
      const userResponse = await fetch(`${X_API_BASE_URL}/2/users/me`, {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      if (userResponse.ok) {
        const userData = (await userResponse.json()) as XcomUserResponse;
        xUserId = userData.data?.id || null;
        xUsername = userData.data?.username || null;
      }
    } catch (error) {
      console.warn('[X.com] Failed to fetch user info:', error);
      // Continue without user info
    }

    // Calculate expiration time
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null;

    // Handle login flow vs link flow
    let finalUserId: string;
    let isNewUser = false;

    if (mode === 'login') {
      // Login flow: find or create user based on X.com user ID
      if (!xUserId) {
        throw new Error('X.com user ID not found');
      }

      // Check if user already exists with this X.com account
      const existingToken = await XcomOAuthTokenModel.findByXUserId(xUserId);
      if (existingToken) {
        // User exists, use their userId
        finalUserId = existingToken.user_id;
      } else {
        // Create new user with X.com email (if available) or placeholder email
        // X.com doesn't always provide email, so we'll use a placeholder
        const email = xUsername ? `xcom_${xUserId}@xcom.injest.io` : `xcom_${xUserId}@xcom.injest.io`;

        // Check if email already exists (unlikely but possible)
        let user = await UserModel.findByEmail(email);
        if (!user) {
          user = await UserModel.create(email);
          await UserModel.verifyEmail(user.id); // Auto-verify X.com users
          isNewUser = true;
        }

        finalUserId = user.id;
        await ItemAccessModel.linkUserToEmail(finalUserId, user.email);
      }
    } else {
      // Link flow: use userId from state
      if (!userId) {
        throw new Error('User ID required for link flow');
      }
      finalUserId = userId;
    }

    // Store or update tokens
    const token = await XcomOAuthTokenModel.createOrUpdate(finalUserId, {
      userId: finalUserId,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || null,
      tokenType: tokenData.token_type || 'Bearer',
      expiresAt,
      scope: tokenData.scope || null,
      xUserId,
      xUsername,
    });

    return { userId: finalUserId, token, isNewUser };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(userId: string): Promise<XcomOAuthToken> {
    if (!X_CLIENT_ID || !X_CLIENT_SECRET) {
      throw new Error('X.com OAuth credentials are not configured');
    }

    const token = await XcomOAuthTokenModel.findByUserId(userId);
    if (!token) {
      throw new Error('X.com OAuth token not found');
    }

    if (!token.refresh_token) {
      throw new Error('Refresh token not available');
    }

    const tokenResponse = await fetch(`${X_API_BASE_URL}/2/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        refresh_token: token.refresh_token,
        grant_type: 'refresh_token',
        client_id: X_CLIENT_ID,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[X.com] Token refresh failed:', errorText);
      throw new Error('Failed to refresh access token');
    }

    const tokenData = (await tokenResponse.json()) as XcomTokenResponse;

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null;

    const updatedToken = await XcomOAuthTokenModel.update(userId, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || token.refresh_token,
      expiresAt,
    });

    return updatedToken;
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  async getValidAccessToken(userId: string): Promise<string> {
    let token = await XcomOAuthTokenModel.findByUserId(userId);
    if (!token) {
      throw new Error('X.com OAuth token not found');
    }

    // Check if token is expired or about to expire (within 5 minutes)
    const isExpired =
      token.expires_at &&
      new Date(token.expires_at).getTime() - Date.now() < 5 * 60 * 1000;

    if (isExpired && token.refresh_token) {
      try {
        token = await this.refreshToken(userId);
      } catch (error) {
        console.error('[X.com] Failed to refresh token:', error);
        throw new Error('Failed to refresh access token. Please reconnect your X.com account.');
      }
    }

    return token.access_token;
  }

  /**
   * Post a tweet to X.com
   */
  async postTweet(userId: string, text: string): Promise<{ id: string; text: string }> {
    const accessToken = await this.getValidAccessToken(userId);

    const response = await fetch(`${X_API_BASE_URL}/2/tweets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        text: text.substring(0, 280), // X.com has a 280 character limit
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({ error: 'Unknown error' }))) as XcomErrorResponse;
      console.error('[X.com] Post tweet failed:', errorData);
      throw new Error(
        errorData.error?.message || errorData.detail || 'Failed to post tweet to X.com'
      );
    }

    const data = (await response.json()) as XcomTweetResponse;
    return {
      id: data.data.id,
      text: data.data.text,
    };
  }

  /**
   * Check if user has connected X.com account
   */
  async isConnected(userId: string): Promise<boolean> {
    const token = await XcomOAuthTokenModel.findByUserId(userId);
    if (!token) {
      return false;
    }

    // Check if token is still valid
    const isValid = await XcomOAuthTokenModel.isTokenValid(token);
    if (!isValid && token.refresh_token) {
      // Try to refresh
      try {
        await this.refreshToken(userId);
        return true;
      } catch {
        return false;
      }
    }

    return isValid;
  }

  /**
   * Get X.com connection status
   */
  async getConnectionStatus(userId: string): Promise<{
    connected: boolean;
    username: string | null;
    xUserId: string | null;
  }> {
    const token = await XcomOAuthTokenModel.findByUserId(userId);
    if (!token) {
      return { connected: false, username: null, xUserId: null };
    }

    const isValid = await XcomOAuthTokenModel.isTokenValid(token);
    if (!isValid && !token.refresh_token) {
      return { connected: false, username: null, xUserId: null };
    }

    return {
      connected: true,
      username: token.x_username,
      xUserId: token.x_user_id,
    };
  }

  /**
   * Disconnect X.com account
   */
  async disconnect(userId: string): Promise<void> {
    await XcomOAuthTokenModel.delete(userId);
  }
}

export const xcomService = new XcomService();
