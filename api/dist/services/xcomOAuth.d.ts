/**
 * X.com OAuth 2.0 PKCE Service
 * Handles OAuth 2.0 authentication flow with PKCE
 */
export declare class XComOAuthService {
    private clientId;
    private clientSecret;
    private callbackUrl;
    constructor();
    /**
     * Generate a random code verifier for PKCE
     */
    generateCodeVerifier(): string;
    /**
     * Generate code challenge from verifier (SHA256 hash)
     */
    generateCodeChallenge(verifier: string): string;
    /**
     * Generate state parameter for CSRF protection
     */
    generateState(): string;
    /**
     * Get authorization URL for OAuth flow
     * Encodes userId in state parameter for callback retrieval
     */
    getAuthorizationUrl(userId: string, codeChallenge: string, state: string): string;
    /**
     * Get authorization URL for login OAuth flow
     * Uses separate callback and stores verifier by session ID
     */
    getLoginAuthorizationUrl(sessionId: string, codeChallenge: string, state: string, loginCallbackUrl: string): string;
    /**
     * Store code verifier for login flow
     */
    storeLoginVerifier(sessionId: string, verifier: string, state: string): void;
    /**
     * Retrieve code verifier for login flow
     */
    retrieveLoginVerifier(sessionId: string, stateNonce: string): string | null;
    /**
     * Store code verifier temporarily (expires in 10 minutes)
     */
    storeCodeVerifier(userId: string, verifier: string, state: string): void;
    /**
     * Retrieve code verifier and remove it from store
     * state should be the nonce (not the encoded state)
     */
    retrieveCodeVerifier(userId: string, stateNonce: string): string | null;
    /**
     * Decode state parameter to extract userId and nonce
     */
    decodeState(encodedState: string): {
        userId: string;
        nonce: string;
    } | null;
    /**
     * Exchange authorization code for access token
     */
    exchangeCodeForTokens(code: string, codeVerifier: string, redirectUri?: string): Promise<{
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        token_type?: string;
        scope?: string;
    }>;
    /**
     * Refresh access token using refresh token
     */
    refreshAccessToken(refreshToken: string): Promise<{
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        token_type?: string;
        scope?: string;
    }>;
    /**
     * Revoke access token
     */
    revokeToken(token: string, tokenTypeHint?: 'access_token' | 'refresh_token'): Promise<void>;
    /**
     * Get user info from X.com API
     */
    getUserInfo(accessToken: string): Promise<{
        id: string;
        username: string;
        name?: string;
    }>;
}
export declare function getXComOAuthService(): XComOAuthService;
//# sourceMappingURL=xcomOAuth.d.ts.map