import pool from '../config/database.js';
import { encrypt, decrypt, encryptField, decryptField } from '../utils/encryption.js';

export interface XcomOAuthToken {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  expires_at: Date | null;
  scope: string | null;
  x_user_id: string | null;
  x_username: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateXcomOAuthTokenInput {
  userId: string;
  accessToken: string;
  refreshToken?: string | null;
  tokenType?: string;
  expiresAt?: Date | null;
  scope?: string | null;
  xUserId?: string | null;
  xUsername?: string | null;
}

export interface UpdateXcomOAuthTokenInput {
  accessToken?: string;
  refreshToken?: string | null;
  tokenType?: string;
  expiresAt?: Date | null;
  scope?: string | null;
  xUserId?: string | null;
  xUsername?: string | null;
}

export class XcomOAuthTokenModel {
  /**
   * Decrypt token fields from database result
   */
  private static decryptToken(token: any): XcomOAuthToken {
    if (!token) {
      return token;
    }
    return {
      ...token,
      access_token: decryptField(token.access_token) || '',
      refresh_token: decryptField(token.refresh_token),
    };
  }

  static async findByUserId(userId: string): Promise<XcomOAuthToken | null> {
    const result = await pool.query(
      'SELECT * FROM xcom_oauth_tokens WHERE user_id = $1',
      [userId]
    );
    if (!result.rows[0]) {
      return null;
    }
    return this.decryptToken(result.rows[0]);
  }

  static async findById(id: string): Promise<XcomOAuthToken | null> {
    const result = await pool.query(
      'SELECT * FROM xcom_oauth_tokens WHERE id = $1',
      [id]
    );
    if (!result.rows[0]) {
      return null;
    }
    return this.decryptToken(result.rows[0]);
  }

  static async create(input: CreateXcomOAuthTokenInput): Promise<XcomOAuthToken> {
    // Encrypt tokens before storing
    const encryptedAccessToken = encrypt(input.accessToken);
    const encryptedRefreshToken = input.refreshToken ? encrypt(input.refreshToken) : null;

    const result = await pool.query(
      `INSERT INTO xcom_oauth_tokens (
        user_id, access_token, refresh_token, token_type, expires_at, scope, x_user_id, x_username
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        input.userId,
        encryptedAccessToken,
        encryptedRefreshToken,
        input.tokenType ?? 'Bearer',
        input.expiresAt ?? null,
        input.scope ?? null,
        input.xUserId ?? null,
        input.xUsername ?? null,
      ]
    );
    return this.decryptToken(result.rows[0]);
  }

  static async update(userId: string, input: UpdateXcomOAuthTokenInput): Promise<XcomOAuthToken> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    if (input.accessToken !== undefined) {
      fields.push(`access_token = $${paramCount++}`);
      values.push(encrypt(input.accessToken));
    }
    if (input.refreshToken !== undefined) {
      fields.push(`refresh_token = $${paramCount++}`);
      values.push(input.refreshToken ? encrypt(input.refreshToken) : null);
    }
    if (input.tokenType !== undefined) {
      fields.push(`token_type = $${paramCount++}`);
      values.push(input.tokenType);
    }
    if (input.expiresAt !== undefined) {
      fields.push(`expires_at = $${paramCount++}`);
      values.push(input.expiresAt);
    }
    if (input.scope !== undefined) {
      fields.push(`scope = $${paramCount++}`);
      values.push(input.scope);
    }
    if (input.xUserId !== undefined) {
      fields.push(`x_user_id = $${paramCount++}`);
      values.push(input.xUserId);
    }
    if (input.xUsername !== undefined) {
      fields.push(`x_username = $${paramCount++}`);
      values.push(input.xUsername);
    }

    if (fields.length === 0) {
      const existing = await this.findByUserId(userId);
      if (!existing) {
        throw new Error('X.com OAuth token not found');
      }
      return existing;
    }

    fields.push(`updated_at = NOW()`);
    values.push(userId);

    const result = await pool.query(
      `UPDATE xcom_oauth_tokens
       SET ${fields.join(', ')}
       WHERE user_id = $${paramCount}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('X.com OAuth token not found');
    }

    return this.decryptToken(result.rows[0]);
  }

  static async createOrUpdate(userId: string, input: CreateXcomOAuthTokenInput): Promise<XcomOAuthToken> {
    const existing = await this.findByUserId(userId);
    if (existing) {
      return this.update(userId, {
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        tokenType: input.tokenType,
        expiresAt: input.expiresAt,
        scope: input.scope,
        xUserId: input.xUserId,
        xUsername: input.xUsername,
      });
    }
    return this.create(input);
  }

  static async delete(userId: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM xcom_oauth_tokens WHERE user_id = $1 RETURNING id',
      [userId]
    );
    return result.rows.length > 0;
  }

  static async isTokenValid(token: XcomOAuthToken): Promise<boolean> {
    if (!token.expires_at) {
      // If no expiration, assume token is valid
      return true;
    }
    const now = new Date();
    return new Date(token.expires_at) > now;
  }

  static async findByXUserId(xUserId: string): Promise<XcomOAuthToken | null> {
    const result = await pool.query(
      'SELECT * FROM xcom_oauth_tokens WHERE x_user_id = $1',
      [xUserId]
    );
    if (!result.rows[0]) {
      return null;
    }
    return this.decryptToken(result.rows[0]);
  }
}
