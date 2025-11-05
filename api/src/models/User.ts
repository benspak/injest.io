import pool from '../config/database.js';

export interface User {
  id: string;
  email: string;
  verified: boolean;
  is_premium?: boolean;
  stripe_customer_id?: string;
  bookmark_import_count?: number;
  last_bookmark_import_payment?: Date;
  created_at: Date;
  updated_at: Date;
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
}
