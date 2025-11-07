/**
 * X.com (Twitter) API Service
 * Handles media upload and post creation
 */
interface CreatePostResponse {
    data: {
        id: string;
        text: string;
    };
    errors?: Array<{
        detail: string;
        status: number;
        title: string;
        type: string;
    }>;
}
export declare class XComService {
    private apiKey;
    private apiSecret;
    private accessToken;
    private accessTokenSecret;
    private bearerToken;
    private userAccessToken?;
    constructor(userAccessToken?: string);
    /**
     * Upload media (image) to X.com
     * Note: The v1.1 media upload endpoint requires OAuth 1.0a signing, even with OAuth 2.0 tokens.
     * We prioritize OAuth 1.0a credentials if available, otherwise try OAuth 2.0 (may fail with 403).
     */
    uploadMedia(imageBuffer: Buffer, mimeType: string): Promise<string>;
    /**
     * Upload media using OAuth 1.0a (required for v1.1 media upload endpoint)
     */
    private uploadMediaOAuth1;
    /**
     * Upload media using OAuth 2.0 Bearer token (experimental - may not work)
     * Note: X.com's v1.1 media upload endpoint typically requires OAuth 1.0a signing.
     * This method attempts OAuth 2.0 but will likely fail with 403 Forbidden.
     * Use uploadMediaOAuth1 instead when OAuth 1.0a credentials are available.
     */
    private uploadMediaOAuth2;
    /**
     * Create a post on X.com with text and optional media
     * Uses OAuth 2.0 Bearer token (user token preferred, falls back to static)
     */
    createPost(text: string, mediaId?: string): Promise<CreatePostResponse>;
    /**
     * Verify token is valid and has necessary scopes
     * This is a helper method to provide better error messages
     */
    private verifyTokenScopes;
}
/**
 * Get XComService instance for a specific user
 * Automatically handles token refresh if needed
 */
export declare function getXComServiceForUser(userId: string, userTokens: {
    access_token: string;
    refresh_token?: string;
    expires_at?: Date;
} | null, onTokenRefresh?: (tokens: {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
}) => Promise<void>): Promise<XComService>;
export declare function getXComService(): XComService;
export {};
//# sourceMappingURL=xcom.d.ts.map