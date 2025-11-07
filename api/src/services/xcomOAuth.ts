/**
 * X.com OAuth 2.0 PKCE Service
 * Handles OAuth 2.0 authentication flow with PKCE
 */

import crypto from 'crypto';
import { FRONTEND_URL } from '../config/auth.js';

interface CodeVerifierStore {
  verifier: string;
  expiresAt: number;
}

// In-memory store for code verifiers (keyed by userId or sessionId)
// In production, consider using Redis for distributed systems
const codeVerifierStore = new Map<string, CodeVerifierStore>();
const loginVerifierStore = new Map<string, CodeVerifierStore>();

// Clean up expired verifiers every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, store] of codeVerifierStore.entries()) {
    if (store.expiresAt < now) {
      codeVerifierStore.delete(key);
    }
  }
  for (const [key, store] of loginVerifierStore.entries()) {
    if (store.expiresAt < now) {
      loginVerifierStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

export class XComOAuthService {
  private clientId: string;
  private clientSecret: string;
  private callbackUrl: string;

  constructor() {
    this.clientId = process.env.X_CLIENT_ID || '';
    this.clientSecret = process.env.X_CLIENT_SECRET || '';
    this.callbackUrl = process.env.X_CALLBACK_URL || `${process.env.API_URL || 'http://localhost:5555'}/api/xcom/callback`;

    if (!this.clientId || !this.clientSecret) {
      throw new Error('X_CLIENT_ID and X_CLIENT_SECRET environment variables are required');
    }
  }

  /**
   * Generate a random code verifier for PKCE
   */
  generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Generate code challenge from verifier (SHA256 hash)
   */
  generateCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }

  /**
   * Generate state parameter for CSRF protection
   */
  generateState(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Get authorization URL for OAuth flow
   * Encodes userId in state parameter for callback retrieval
   */
  getAuthorizationUrl(userId: string, codeChallenge: string, state: string): string {
    // Encode userId in state as base64 JSON
    const stateData = {
      userId,
      nonce: state, // Use state as nonce for CSRF protection
    };
    const encodedState = Buffer.from(JSON.stringify(stateData)).toString('base64');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.callbackUrl,
      scope: 'tweet.read tweet.write users.read offline.access media.write',
      state: encodedState,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Get authorization URL for login OAuth flow
   * Uses separate callback and stores verifier by session ID
   */
  getLoginAuthorizationUrl(sessionId: string, codeChallenge: string, state: string, loginCallbackUrl: string): string {
    // Encode sessionId in state as base64 JSON
    const stateData = {
      sessionId,
      nonce: state,
      type: 'login',
    };
    const encodedState = Buffer.from(JSON.stringify(stateData)).toString('base64');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: loginCallbackUrl,
      scope: 'users.read tweet.read offline.access',
      state: encodedState,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Store code verifier for login flow
   */
  storeLoginVerifier(sessionId: string, verifier: string, state: string): void {
    loginVerifierStore.set(`${sessionId}:${state}`, {
      verifier,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });
  }

  /**
   * Retrieve code verifier for login flow
   */
  retrieveLoginVerifier(sessionId: string, stateNonce: string): string | null {
    const key = `${sessionId}:${stateNonce}`;
    const store = loginVerifierStore.get(key);
    if (!store || store.expiresAt < Date.now()) {
      loginVerifierStore.delete(key);
      return null;
    }
    loginVerifierStore.delete(key);
    return store.verifier;
  }

  /**
   * Store code verifier temporarily (expires in 10 minutes)
   */
  storeCodeVerifier(userId: string, verifier: string, state: string): void {
    // Store verifier keyed by userId and state nonce
    codeVerifierStore.set(`${userId}:${state}`, {
      verifier,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });
  }

  /**
   * Retrieve code verifier and remove it from store
   * state should be the nonce (not the encoded state)
   */
  retrieveCodeVerifier(userId: string, stateNonce: string): string | null {
    const key = `${userId}:${stateNonce}`;
    const store = codeVerifierStore.get(key);
    if (!store || store.expiresAt < Date.now()) {
      codeVerifierStore.delete(key);
      return null;
    }
    codeVerifierStore.delete(key);
    return store.verifier;
  }

  /**
   * Decode state parameter to extract userId and nonce
   */
  decodeState(encodedState: string): { userId: string; nonce: string } | null {
    try {
      const stateData = JSON.parse(Buffer.from(encodedState, 'base64').toString());
      return {
        userId: stateData.userId,
        nonce: stateData.nonce,
      };
    } catch {
      return null;
    }
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForTokens(code: string, codeVerifier: string, redirectUri?: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
  }> {
    const url = 'https://api.twitter.com/2/oauth2/token';
    const callbackUrl = redirectUri || this.callbackUrl;

    const params = new URLSearchParams({
      code: code,
      grant_type: 'authorization_code',
      client_id: this.clientId,
      redirect_uri: callbackUrl,
      code_verifier: codeVerifier,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Token exchange error:', {
        status: response.status,
        statusText: response.statusText,
        data: JSON.stringify(data, null, 2),
      });
      const errorMessage = data.error_description || data.error || 'Failed to exchange code for tokens';
      throw new Error(errorMessage);
    }

    // Log the scopes returned (for debugging)
    if (data.scope) {
      console.log('Token exchange successful. Scopes granted:', data.scope);
    }

    return data;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
  }> {
    const url = 'https://api.twitter.com/2/oauth2/token';

    const params = new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      client_id: this.clientId,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.error_description || data.error || 'Failed to refresh access token';
      throw new Error(errorMessage);
    }

    return data;
  }

  /**
   * Revoke access token
   */
  async revokeToken(token: string, tokenTypeHint: 'access_token' | 'refresh_token' = 'access_token'): Promise<void> {
    const url = 'https://api.twitter.com/2/oauth2/revoke';

    const params = new URLSearchParams({
      token: token,
      token_type_hint: tokenTypeHint,
      client_id: this.clientId,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const errorMessage = data.error_description || data.error || 'Failed to revoke token';
      throw new Error(errorMessage);
    }
  }

  /**
   * Get user info from X.com API
   */
  async getUserInfo(accessToken: string): Promise<{ id: string; username: string; name?: string }> {
    // Use api.twitter.com as it's the standard endpoint (api.x.com may not work for all endpoints)
    // Try without user.fields first, then with it if needed
    let url = 'https://api.twitter.com/2/users/me';

    // Try with user.fields parameter (X.com API v2 format)
    const params = new URLSearchParams({
      'user.fields': 'id,username,name',
    });
    url = `${url}?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Injest.io/1.0',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      // Log the full error for debugging
      console.error('X.com API error:', {
        status: response.status,
        statusText: response.statusText,
        url: url,
        data: JSON.stringify(data, null, 2),
        accessTokenPrefix: accessToken?.substring(0, 20) + '...',
      });

      // If 403, try without user.fields parameter
      if (response.status === 403) {
        console.log('403 error received, trying without user.fields parameter...');
        const simpleUrl = 'https://api.twitter.com/2/users/me';
        const simpleResponse = await fetch(simpleUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Injest.io/1.0',
          },
        });

        const simpleData = await simpleResponse.json();

        if (!simpleResponse.ok) {
          console.error('X.com API error (simple request):', {
            status: simpleResponse.status,
            statusText: simpleResponse.statusText,
            data: JSON.stringify(simpleData, null, 2),
          });
          const errorMessage = simpleData.errors?.[0]?.detail || simpleData.errors?.[0]?.title || `Failed to get user info (${simpleResponse.status})`;
          throw new Error(errorMessage);
        }

        // Use the simple response
        if (!simpleData.data || !simpleData.data.id) {
          console.error('Invalid X.com API response structure:', JSON.stringify(simpleData, null, 2));
          throw new Error('Invalid response format from X.com API');
        }

        return {
          id: simpleData.data.id,
          username: simpleData.data.username || simpleData.data.name || 'unknown',
          name: simpleData.data.name,
        };
      }

      const errorMessage = data.errors?.[0]?.detail || data.errors?.[0]?.title || `Failed to get user info (${response.status})`;
      throw new Error(errorMessage);
    }

    // Validate response structure
    if (!data.data || !data.data.id) {
      console.error('Invalid X.com API response structure:', JSON.stringify(data, null, 2));
      throw new Error('Invalid response format from X.com API');
    }

    return {
      id: data.data.id,
      username: data.data.username || data.data.name || 'unknown',
      name: data.data.name,
    };
  }
}

// Export singleton instance
let xcomOAuthServiceInstance: XComOAuthService | null = null;

export function getXComOAuthService(): XComOAuthService {
  if (!xcomOAuthServiceInstance) {
    xcomOAuthServiceInstance = new XComOAuthService();
  }
  return xcomOAuthServiceInstance;
}
