import pool from '../config/database.js';

export interface User {
  id: string;
  email: string;
  verified: boolean;
  is_premium?: boolean;
  stripe_customer_id?: string;
  bookmark_import_count?: number;
  last_bookmark_import_payment?: Date;
  xcom_access_token?: string;
  xcom_refresh_token?: string;
  xcom_token_expires_at?: Date;
  xcom_user_id?: string;
  xcom_username?: string;
  created_at: Date;
  updated_at: Date;
}

export interface XComTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  user_id?: string;
  username?: string;
}

export class UserModel {
  static async findByEmail(email: string): Promise<User | null> {
    // Case-insensitive email lookup
    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    return result.rows[0] || null;
  }

  static async findById(id: string): Promise<User | null> {
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  static async create(email: string): Promise<User> {
    const result = await pool.query(
      'INSERT INTO users (email, verified) VALUES ($1, $2) RETURNING *',
      [email, false]
    );
    return result.rows[0];
  }

  static async verifyEmail(id: string): Promise<User> {
    const result = await pool.query(
      'UPDATE users SET verified = TRUE WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }

  static async update(id: string, updates: Partial<User>): Promise<User> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.email !== undefined) {
      fields.push(`email = $${paramCount++}`);
      values.push(updates.email);
    }
    if (updates.verified !== undefined) {
      fields.push(`verified = $${paramCount++}`);
      values.push(updates.verified);
    }
    if (updates.is_premium !== undefined) {
      fields.push(`is_premium = $${paramCount++}`);
      values.push(updates.is_premium);
    }
    if (updates.stripe_customer_id !== undefined) {
      fields.push(`stripe_customer_id = $${paramCount++}`);
      values.push(updates.stripe_customer_id);
    }
    if (updates.bookmark_import_count !== undefined) {
      fields.push(`bookmark_import_count = $${paramCount++}`);
      values.push(updates.bookmark_import_count);
    }
    if (updates.last_bookmark_import_payment !== undefined) {
      fields.push(`last_bookmark_import_payment = $${paramCount++}`);
      values.push(updates.last_bookmark_import_payment);
    }
    if (updates.xcom_access_token !== undefined) {
      fields.push(`xcom_access_token = $${paramCount++}`);
      values.push(updates.xcom_access_token);
    }
    if (updates.xcom_refresh_token !== undefined) {
      fields.push(`xcom_refresh_token = $${paramCount++}`);
      values.push(updates.xcom_refresh_token);
    }
    if (updates.xcom_token_expires_at !== undefined) {
      fields.push(`xcom_token_expires_at = $${paramCount++}`);
      values.push(updates.xcom_token_expires_at);
    }
    if (updates.xcom_user_id !== undefined) {
      fields.push(`xcom_user_id = $${paramCount++}`);
      values.push(updates.xcom_user_id);
    }
    if (updates.xcom_username !== undefined) {
      fields.push(`xcom_username = $${paramCount++}`);
      values.push(updates.xcom_username);
    }

    if (fields.length === 0) {
      return await this.findById(id) as User;
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  /**
   * Update X.com OAuth tokens for a user
   */
  static async updateXComTokens(userId: string, tokens: XComTokens): Promise<User> {
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : undefined;

    return await this.update(userId, {
      xcom_access_token: tokens.access_token,
      xcom_refresh_token: tokens.refresh_token,
      xcom_token_expires_at: expiresAt,
      xcom_user_id: tokens.user_id,
      xcom_username: tokens.username,
    });
  }

  /**
   * Get X.com tokens for a user
   */
  static async getXComTokens(userId: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_at?: Date;
    user_id?: string;
    username?: string;
  } | null> {
    const user = await this.findById(userId);
    if (!user || !user.xcom_access_token) {
      return null;
    }

    return {
      access_token: user.xcom_access_token,
      refresh_token: user.xcom_refresh_token,
      expires_at: user.xcom_token_expires_at,
      user_id: user.xcom_user_id,
      username: user.xcom_username,
    };
  }

  /**
   * Clear X.com tokens (disconnect)
   */
  static async clearXComTokens(userId: string): Promise<User> {
    return await this.update(userId, {
      xcom_access_token: null,
      xcom_refresh_token: null,
      xcom_token_expires_at: null,
      xcom_user_id: null,
      xcom_username: null,
    });
  }
}
