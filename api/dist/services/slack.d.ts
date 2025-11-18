export declare class SlackService {
    /**
     * Generate a random state string for CSRF protection
     */
    private generateState;
    /**
     * Create a state token containing user ID and random state
     */
    private createStateToken;
    /**
     * Verify and decode state token
     */
    private verifyStateToken;
    /**
     * Initiate OAuth 2.0 flow for linking account (requires userId)
     * Returns the authorization URL and state token
     */
    initiateOAuth(userId: string): Promise<{
        authUrl: string;
        state: string;
    }>;
    /**
     * Handle OAuth callback and exchange authorization code for tokens
     */
    handleCallback(code: string, state: string): Promise<{
        userId: string;
        workspaceId: string;
        workspaceName: string;
        botUserId: string;
    }>;
    /**
     * Refresh access token using refresh token (if available)
     * Note: Slack tokens don't expire, but we'll implement this for consistency
     */
    refreshToken(userId: string): Promise<void>;
    /**
     * Get valid access token, refreshing if necessary
     */
    getValidAccessToken(userId: string): Promise<string>;
    /**
     * Get user token (authed_user_token) for fallback when bot token doesn't have access
     */
    getUserToken(userId: string): Promise<string | null>;
    /**
     * Verify webhook request signature
     */
    verifyWebhookSignature(timestamp: string, signature: string, body: string): boolean;
    /**
     * Check if user has connected Slack account
     */
    isConnected(userId: string): Promise<boolean>;
    /**
     * Get Slack connection status
     */
    getConnectionStatus(userId: string): Promise<{
        connected: boolean;
        workspaceId: string | null;
        workspaceName: string | null;
    }>;
    /**
     * Disconnect Slack account
     */
    disconnect(userId: string): Promise<void>;
}
export declare const slackService: SlackService;
//# sourceMappingURL=slack.d.ts.map