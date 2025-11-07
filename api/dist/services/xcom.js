/**
 * X.com (Twitter) API Service
 * Handles media upload and post creation
 */
import FormData from 'form-data';
import https from 'https';
import crypto from 'crypto';
import { getXComOAuthService } from './xcomOAuth.js';
export class XComService {
    apiKey;
    apiSecret;
    accessToken;
    accessTokenSecret;
    bearerToken;
    userAccessToken; // OAuth 2.0 access token for user
    constructor(userAccessToken) {
        // OAuth 1.0a credentials (for media upload - fallback only)
        this.apiKey = process.env.X_API_KEY || '';
        this.apiSecret = process.env.X_API_SECRET || '';
        this.accessToken = process.env.X_ACCESS_TOKEN || '';
        this.accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET || '';
        // OAuth 2.0 Bearer token (for post creation - fallback only)
        this.bearerToken = process.env.X_BEARER_TOKEN || '';
        // User's OAuth 2.0 access token (preferred when available)
        this.userAccessToken = userAccessToken;
        // Only require static credentials if no user token provided
        if (!this.userAccessToken && !this.bearerToken) {
            throw new Error('Either user access token or X_BEARER_TOKEN environment variable is required');
        }
    }
    /**
     * Upload media (image) to X.com
     * Note: The v1.1 media upload endpoint requires OAuth 1.0a signing, even with OAuth 2.0 tokens.
     * We prioritize OAuth 1.0a credentials if available, otherwise try OAuth 2.0 (may fail with 403).
     */
    async uploadMedia(imageBuffer, mimeType) {
        // Check if we have OAuth 1.0a credentials - use them for media upload (required for v1.1 endpoint)
        if (this.apiKey && this.apiSecret && this.accessToken && this.accessTokenSecret) {
            return this.uploadMediaOAuth1(imageBuffer, mimeType);
        }
        // If no OAuth 1.0a credentials, try OAuth 2.0 (may not work for v1.1 endpoint)
        if (this.userAccessToken) {
            try {
                return await this.uploadMediaOAuth2(imageBuffer, mimeType);
            }
            catch (error) {
                // If OAuth 2.0 fails with 403, it means we need OAuth 1.0a for media uploads
                if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
                    throw new Error('Media upload requires OAuth 1.0a credentials. Please configure X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, and X_ACCESS_TOKEN_SECRET environment variables. OAuth 2.0 tokens cannot be used for the v1.1 media upload endpoint.');
                }
                throw error;
            }
        }
        throw new Error('X.com OAuth 1.0a credentials are required for media upload. Please configure X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, and X_ACCESS_TOKEN_SECRET environment variables.');
    }
    /**
     * Upload media using OAuth 1.0a (required for v1.1 media upload endpoint)
     */
    async uploadMediaOAuth1(imageBuffer, mimeType) {
        return new Promise((resolve, reject) => {
            const form = new FormData();
            form.append('media', imageBuffer, {
                filename: 'image.jpg',
                contentType: mimeType,
            });
            const url = 'https://upload.twitter.com/1.1/media/upload.json';
            const formHeaders = form.getHeaders();
            // Generate OAuth 1.0a signature manually for multipart/form-data
            const oauthParams = {
                oauth_consumer_key: this.apiKey,
                oauth_token: this.accessToken,
                oauth_nonce: crypto.randomBytes(16).toString('hex'),
                oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
                oauth_signature_method: 'HMAC-SHA1',
                oauth_version: '1.0',
            };
            // Create signature base string
            const normalizedParams = Object.keys(oauthParams)
                .sort()
                .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(oauthParams[key])}`)
                .join('&');
            const baseString = `POST&${encodeURIComponent(url)}&${encodeURIComponent(normalizedParams)}`;
            const signingKey = `${encodeURIComponent(this.apiSecret)}&${encodeURIComponent(this.accessTokenSecret)}`;
            const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
            oauthParams.oauth_signature = signature;
            // Create authorization header
            const authParams = Object.keys(oauthParams)
                .sort()
                .map((key) => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
                .join(', ');
            const authHeader = `OAuth ${authParams}`;
            const options = {
                hostname: 'upload.twitter.com',
                path: '/1.1/media/upload.json',
                method: 'POST',
                headers: {
                    'Authorization': authHeader,
                    ...formHeaders,
                },
            };
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        try {
                            const error = JSON.parse(data);
                            reject(new Error(`Media upload failed: ${error.errors?.[0]?.message || data}`));
                        }
                        catch {
                            reject(new Error(`Media upload failed: ${res.statusCode} ${data}`));
                        }
                        return;
                    }
                    try {
                        const response = JSON.parse(data);
                        resolve(response.media_id_string);
                    }
                    catch (error) {
                        reject(new Error('Failed to parse media upload response'));
                    }
                });
            });
            req.on('error', (error) => {
                reject(error);
            });
            form.pipe(req);
        });
    }
    /**
     * Upload media using OAuth 2.0 Bearer token (experimental - may not work)
     * Note: X.com's v1.1 media upload endpoint typically requires OAuth 1.0a signing.
     * This method attempts OAuth 2.0 but will likely fail with 403 Forbidden.
     * Use uploadMediaOAuth1 instead when OAuth 1.0a credentials are available.
     */
    async uploadMediaOAuth2(imageBuffer, mimeType) {
        if (!this.userAccessToken) {
            throw new Error('User access token is required for OAuth 2.0 media upload');
        }
        // Determine media category based on MIME type
        let mediaCategory = 'tweet_image'; // Default for images
        if (mimeType.startsWith('video/')) {
            mediaCategory = 'tweet_video';
        }
        else if (mimeType.startsWith('image/gif')) {
            mediaCategory = 'tweet_gif';
        }
        // Step 1: INIT - Initialize the upload
        // Use v1.1 endpoint at upload.twitter.com (even with OAuth 2.0 tokens)
        const initForm = new FormData();
        initForm.append('command', 'INIT');
        initForm.append('total_bytes', imageBuffer.length.toString());
        initForm.append('media_type', mimeType);
        initForm.append('media_category', mediaCategory);
        const mediaId = await new Promise((resolve, reject) => {
            const formHeaders = initForm.getHeaders();
            const options = {
                hostname: 'upload.twitter.com',
                path: '/1.1/media/upload.json',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.userAccessToken}`,
                    ...formHeaders,
                },
            };
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    if (res.statusCode !== 200 && res.statusCode !== 201) {
                        try {
                            const error = JSON.parse(data);
                            const errorMessage = error.errors?.[0]?.message || error.errors?.[0]?.detail || error.title || error.message || 'Invalid Request';
                            console.error('INIT request failed:', {
                                statusCode: res.statusCode,
                                error: error,
                                requestData: {
                                    command: 'INIT',
                                    total_bytes: imageBuffer.length,
                                    media_type: mimeType,
                                    media_category: mediaCategory,
                                },
                            });
                            reject(new Error(`INIT failed: ${errorMessage}`));
                        }
                        catch (parseError) {
                            console.error('INIT request failed (unparseable response):', {
                                statusCode: res.statusCode,
                                responseData: data,
                            });
                            reject(new Error(`INIT failed: ${res.statusCode} ${data}`));
                        }
                        return;
                    }
                    try {
                        const response = JSON.parse(data);
                        const id = response.media_id_string || response.media_id;
                        if (!id) {
                            console.error('INIT succeeded but no media_id in response:', response);
                            reject(new Error('INIT succeeded but no media_id returned'));
                            return;
                        }
                        resolve(String(id));
                    }
                    catch (error) {
                        console.error('Failed to parse INIT response:', data);
                        reject(new Error('Failed to parse INIT response'));
                    }
                });
            });
            req.on('error', (error) => {
                console.error('INIT request network error:', error);
                reject(error);
            });
            initForm.pipe(req);
        });
        // Step 2: APPEND - Upload the media data
        // For images under 5MB, we can send the entire file in one APPEND
        const appendForm = new FormData();
        appendForm.append('command', 'APPEND');
        appendForm.append('media_id', mediaId);
        appendForm.append('segment_index', '0');
        appendForm.append('media', imageBuffer, {
            filename: `image.${mimeType.split('/')[1]}`,
            contentType: mimeType,
        });
        await new Promise((resolve, reject) => {
            const formHeaders = appendForm.getHeaders();
            const options = {
                hostname: 'upload.twitter.com',
                path: '/1.1/media/upload.json',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.userAccessToken}`,
                    ...formHeaders,
                },
            };
            const req = https.request(options, (res) => {
                // APPEND returns 204 No Content on success
                if (res.statusCode === 204) {
                    resolve();
                    return;
                }
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        const error = JSON.parse(data);
                        reject(new Error(`APPEND failed: ${error.errors?.[0]?.detail || error.title || error.message || data}`));
                    }
                    catch {
                        reject(new Error(`APPEND failed: ${res.statusCode} ${data}`));
                    }
                });
            });
            req.on('error', reject);
            appendForm.pipe(req);
        });
        // Step 3: FINALIZE - Complete the upload
        const finalizeForm = new FormData();
        finalizeForm.append('command', 'FINALIZE');
        finalizeForm.append('media_id', mediaId);
        await new Promise((resolve, reject) => {
            const formHeaders = finalizeForm.getHeaders();
            const options = {
                hostname: 'upload.twitter.com',
                path: '/1.1/media/upload.json',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.userAccessToken}`,
                    ...formHeaders,
                },
            };
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    if (res.statusCode !== 200 && res.statusCode !== 201) {
                        try {
                            const error = JSON.parse(data);
                            reject(new Error(`FINALIZE failed: ${error.errors?.[0]?.detail || error.title || error.message || data}`));
                        }
                        catch {
                            reject(new Error(`FINALIZE failed: ${res.statusCode} ${data}`));
                        }
                        return;
                    }
                    try {
                        const response = JSON.parse(data);
                        // Check if processing is needed (for videos/gifs)
                        if (response.processing_info) {
                            // For images, processing is usually instant, but we should check
                            // For now, if processing_info exists, we'll assume it's ready soon
                            // In production, you might want to poll the STATUS endpoint
                        }
                        resolve();
                    }
                    catch (error) {
                        // If response is empty or not JSON, that's OK for FINALIZE
                        if (data.trim() === '') {
                            resolve();
                        }
                        else {
                            reject(new Error('Failed to parse FINALIZE response'));
                        }
                    }
                });
            });
            req.on('error', reject);
            finalizeForm.pipe(req);
        });
        return mediaId;
    }
    /**
     * Create a post on X.com with text and optional media
     * Uses OAuth 2.0 Bearer token (user token preferred, falls back to static)
     */
    async createPost(text, mediaId) {
        // Use api.x.com for consistency with media upload endpoints
        const url = 'https://api.x.com/2/tweets';
        const accessToken = this.userAccessToken || this.bearerToken;
        if (!accessToken) {
            throw new Error('No access token available for creating post. Either user access token or X_BEARER_TOKEN is required.');
        }
        const body = {
            text: text.substring(0, 280), // X.com has a 280 character limit
        };
        if (mediaId) {
            // Ensure mediaId is a string (X.com API expects string array)
            // Media uploaded with OAuth 1.0a is compatible with OAuth 2.0 tweet creation
            body.media = {
                media_ids: [String(mediaId)],
            };
        }
        // First, verify the token is valid and has necessary permissions
        try {
            await this.verifyTokenScopes(accessToken);
        }
        catch (verifyError) {
            // If verification fails, log but continue - the actual API call will provide better error
            console.warn('Token verification warning:', verifyError.message);
        }
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        const data = await response.json();
        if (!response.ok) {
            // Log full error details for debugging
            console.error('X.com API Error Response:', {
                status: response.status,
                statusText: response.statusText,
                data: data,
                body: body,
                url: url,
                tokenPrefix: accessToken?.substring(0, 20) + '...',
                hasMedia: !!mediaId,
            });
            // Extract detailed error message
            let errorMessage = 'Failed to create post';
            if (typeof data === 'object' && data !== null) {
                const errorData = data;
                if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
                    const error = errorData.errors[0];
                    errorMessage = error.detail || error.title || error.message || errorMessage;
                }
                else if (errorData.title) {
                    errorMessage = errorData.title;
                }
                else if (errorData.detail) {
                    errorMessage = errorData.detail;
                }
            }
            else if (typeof data === 'string') {
                errorMessage = data;
            }
            else {
                errorMessage = `Failed to create post: ${response.status} ${response.statusText}`;
            }
            // Add helpful context for 403 errors
            if (response.status === 403) {
                errorMessage += '\n\nTo fix this:\n';
                errorMessage += '1. Ensure your X.com app has "Read and write" permissions enabled in the developer portal\n';
                errorMessage += '2. Re-authorize the connection to grant the "tweet.write" scope\n';
                errorMessage += '3. Check that the OAuth scopes include: tweet.read tweet.write users.read offline.access media.write';
            }
            throw new Error(errorMessage);
        }
        return data;
    }
    /**
     * Verify token is valid and has necessary scopes
     * This is a helper method to provide better error messages
     */
    async verifyTokenScopes(accessToken) {
        try {
            // Try to get user info to verify token is valid
            const response = await fetch('https://api.x.com/2/users/me', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Token is invalid or expired. Please reconnect your X.com account.');
                }
                if (response.status === 403) {
                    throw new Error('Token lacks required permissions. Please re-authorize with write permissions.');
                }
            }
        }
        catch (error) {
            // If verification itself fails, just log it - don't throw
            // The actual API call will provide better context
            if (!error.message?.includes('Token')) {
                throw error;
            }
            throw error;
        }
    }
}
/**
 * Get XComService instance for a specific user
 * Automatically handles token refresh if needed
 */
export async function getXComServiceForUser(userId, userTokens, onTokenRefresh) {
    if (userTokens && userTokens.access_token) {
        // Check if token is expired and needs refresh
        if (userTokens.expires_at && userTokens.expires_at < new Date()) {
            if (userTokens.refresh_token) {
                // Refresh the token
                const oauthService = getXComOAuthService();
                const refreshed = await oauthService.refreshAccessToken(userTokens.refresh_token);
                // Update tokens in database if callback provided
                if (onTokenRefresh) {
                    await onTokenRefresh(refreshed);
                }
                return new XComService(refreshed.access_token);
            }
            else {
                throw new Error('Access token expired and no refresh token available');
            }
        }
        return new XComService(userTokens.access_token);
    }
    // Fall back to static credentials
    return getXComService();
}
// Export singleton instance
let xcomServiceInstance = null;
export function getXComService() {
    if (!xcomServiceInstance) {
        xcomServiceInstance = new XComService();
    }
    return xcomServiceInstance;
}
//# sourceMappingURL=xcom.js.map