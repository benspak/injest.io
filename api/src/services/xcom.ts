/**
 * X.com (Twitter) API Service
 * Handles media upload and post creation
 */

import FormData from 'form-data';
import https from 'https';
import crypto from 'crypto';
import { getXComOAuthService } from './xcomOAuth.js';

interface MediaUploadResponse {
  media_id_string: string;
  media_id: number;
  size?: number;
  expires_after_secs?: number;
}

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

export class XComService {
  private apiKey: string;
  private apiSecret: string;
  private accessToken: string;
  private accessTokenSecret: string;
  private bearerToken: string;
  private userAccessToken?: string; // OAuth 2.0 access token for user

  constructor(userAccessToken?: string) {
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
   * Uses OAuth 2.0 v2 API endpoint when user token is available (requires media.write scope),
   * otherwise falls back to OAuth 1.0a v1.1 endpoint
   */
  async uploadMedia(imageBuffer: Buffer, mimeType: string): Promise<string> {
    // Use OAuth 2.0 v2 API endpoint if user token is available
    if (this.userAccessToken) {
      return this.uploadMediaOAuth2(imageBuffer, mimeType);
    }

    // Fall back to OAuth 1.0a v1.1 endpoint for static credentials
    if (!this.apiKey || !this.apiSecret || !this.accessToken || !this.accessTokenSecret) {
      throw new Error('X.com OAuth credentials are required for media upload. Either user access token (with media.write scope) or OAuth 1.0a credentials (X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET) are required.');
    }

    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append('media', imageBuffer, {
        filename: 'image.jpg',
        contentType: mimeType,
      });

      const url = 'https://upload.twitter.com/1.1/media/upload.json';
      const formHeaders = form.getHeaders();

      // Generate OAuth 1.0a signature manually for multipart/form-data
      const oauthParams: Record<string, string> = {
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
            } catch {
              reject(new Error(`Media upload failed: ${res.statusCode} ${data}`));
            }
            return;
          }
          try {
            const response: MediaUploadResponse = JSON.parse(data);
            resolve(response.media_id_string);
          } catch (error) {
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
   * Upload media using OAuth 2.0 and X.com API v2 endpoint
   * Requires media.write scope in the OAuth token
   * Uses chunked upload process: INIT -> APPEND -> FINALIZE
   */
  private async uploadMediaOAuth2(imageBuffer: Buffer, mimeType: string): Promise<string> {
    if (!this.userAccessToken) {
      throw new Error('User access token is required for OAuth 2.0 media upload');
    }

    // Determine media category based on MIME type
    let mediaCategory = 'tweet_image'; // Default for images
    if (mimeType.startsWith('video/')) {
      mediaCategory = 'tweet_video';
    } else if (mimeType.startsWith('image/gif')) {
      mediaCategory = 'tweet_gif';
    }

    // Step 1: INIT - Initialize the upload
    const initForm = new FormData();
    initForm.append('command', 'INIT');
    initForm.append('total_bytes', imageBuffer.length.toString());
    initForm.append('media_type', mimeType);
    initForm.append('media_category', mediaCategory);

    const mediaId = await new Promise<string>((resolve, reject) => {
      const formHeaders = initForm.getHeaders();
      const options = {
        hostname: 'api.x.com',
        path: '/2/media/upload',
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
              reject(new Error(`INIT failed: ${error.errors?.[0]?.detail || error.title || error.message || data}`));
            } catch {
              reject(new Error(`INIT failed: ${res.statusCode} ${data}`));
            }
            return;
          }
          try {
            const response = JSON.parse(data);
            const id = response.media_id_string || response.media_id;
            if (!id) {
              reject(new Error('INIT succeeded but no media_id returned'));
              return;
            }
            resolve(String(id));
          } catch (error) {
            reject(new Error('Failed to parse INIT response'));
          }
        });
      });

      req.on('error', reject);
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

    await new Promise<void>((resolve, reject) => {
      const formHeaders = appendForm.getHeaders();
      const options = {
        hostname: 'api.x.com',
        path: '/2/media/upload',
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
          } catch {
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

    await new Promise<void>((resolve, reject) => {
      const formHeaders = finalizeForm.getHeaders();
      const options = {
        hostname: 'api.x.com',
        path: '/2/media/upload',
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
            } catch {
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
          } catch (error) {
            // If response is empty or not JSON, that's OK for FINALIZE
            if (data.trim() === '') {
              resolve();
            } else {
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
  async createPost(text: string, mediaId?: string): Promise<CreatePostResponse> {
    const url = 'https://api.twitter.com/2/tweets';
    const accessToken = this.userAccessToken || this.bearerToken;

    if (!accessToken) {
      throw new Error('No access token available for creating post. Either user access token or X_BEARER_TOKEN is required.');
    }

    const body: any = {
      text: text.substring(0, 280), // X.com has a 280 character limit
    };

    if (mediaId) {
      // Ensure mediaId is a string (X.com API expects string array)
      // Note: Media uploaded with OAuth 1.0a may not be usable with OAuth 2.0 tokens
      // If this fails, we may need to ensure media is uploaded with the same auth method
      body.media = {
        media_ids: [String(mediaId)],
      };
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
      });

      // Extract detailed error message
      let errorMessage = 'Failed to create post';
      if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
        const error = data.errors[0];
        errorMessage = error.detail || error.title || error.message || errorMessage;
      } else if (data.title) {
        errorMessage = data.title;
      } else if (data.detail) {
        errorMessage = data.detail;
      } else if (typeof data === 'string') {
        errorMessage = data;
      } else {
        errorMessage = `Failed to create post: ${response.status} ${response.statusText}`;
      }

      throw new Error(errorMessage);
    }

    return data;
  }
}

/**
 * Get XComService instance for a specific user
 * Automatically handles token refresh if needed
 */
export async function getXComServiceForUser(
  userId: string,
  userTokens: {
    access_token: string;
    refresh_token?: string;
    expires_at?: Date;
  } | null,
  onTokenRefresh?: (tokens: { access_token: string; refresh_token?: string; expires_in?: number }) => Promise<void>
): Promise<XComService> {
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
      } else {
        throw new Error('Access token expired and no refresh token available');
      }
    }
    return new XComService(userTokens.access_token);
  }

  // Fall back to static credentials
  return getXComService();
}

// Export singleton instance
let xcomServiceInstance: XComService | null = null;

export function getXComService(): XComService {
  if (!xcomServiceInstance) {
    xcomServiceInstance = new XComService();
  }
  return xcomServiceInstance;
}
