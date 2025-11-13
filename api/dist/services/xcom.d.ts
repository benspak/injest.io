import { type XcomOAuthToken } from '../models/XcomOAuthToken.js';
export declare class XcomService {
    /**
     * Generate a random code verifier for PKCE
     */
    private generateCodeVerifier;
    /**
     * Generate code challenge from code verifier
     */
    private generateCodeChallenge;
    /**
     * Create a state token containing user ID and code verifier
     */
    private createStateToken;
    /**
     * Verify and decode state token
     */
    private verifyStateToken;
    /**
     * Initiate OAuth 2.0 PKCE flow for login (no userId required)
     * Returns the authorization URL and state token
     */
    initiateLoginOAuth(): Promise<{
        authUrl: string;
        state: string;
    }>;
    /**
     * Initiate OAuth 2.0 PKCE flow for linking account (requires userId)
     * Returns the authorization URL and state token
     */
    initiateOAuth(userId: string): Promise<{
        authUrl: string;
        state: string;
    }>;
    /**
     * Handle OAuth callback and exchange authorization code for tokens
     * For login flow: creates user if doesn't exist, returns userId
     * For link flow: uses existing userId from state
     */
    handleCallback(code: string, state: string): Promise<{
        userId: string;
        token: XcomOAuthToken;
        isNewUser?: boolean;
    }>;
    /**
     * Refresh access token using refresh token
     */
    refreshToken(userId: string): Promise<XcomOAuthToken>;
    /**
     * Get valid access token, refreshing if necessary
     */
    getValidAccessToken(userId: string): Promise<string>;
    /**
     * Post a tweet to X.com
     */
    postTweet(userId: string, text: string): Promise<{
        id: string;
        text: string;
    }>;
    /**
     * Check if user has connected X.com account
     */
    isConnected(userId: string): Promise<boolean>;
    /**
     * Get X.com connection status
     */
    getConnectionStatus(userId: string): Promise<{
        connected: boolean;
        username: string | null;
        xUserId: string | null;
    }>;
    /**
     * Disconnect X.com account
     */
    disconnect(userId: string): Promise<void>;
}
export declare const xcomService: XcomService;
//# sourceMappingURL=xcom.d.ts.map