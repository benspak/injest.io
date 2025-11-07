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
     * Uses OAuth 2.0 v2 API endpoint when user token is available (requires media.write scope),
     * otherwise falls back to OAuth 1.0a v1.1 endpoint
     */
    uploadMedia(imageBuffer: Buffer, mimeType: string): Promise<string>;
    /**
     * Upload media using OAuth 2.0 and X.com API v2 endpoint
     * Requires media.write scope in the OAuth token
     * Uses chunked upload process: INIT -> APPEND -> FINALIZE
     */
    private uploadMediaOAuth2;
    /**
     * Create a post on X.com with text and optional media
     * Uses OAuth 2.0 Bearer token (user token preferred, falls back to static)
     */
    createPost(text: string, mediaId?: string): Promise<CreatePostResponse>;
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