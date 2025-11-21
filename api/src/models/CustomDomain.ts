import pool from '../config/database.js';

export interface CustomDomain {
  id: string;
  user_id: string;
  domain: string;
  verification_token: string;
  verified: boolean;
  verified_at: Date | null;
  cname_target: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export class CustomDomainModel {
  static async findByUserId(userId: string): Promise<CustomDomain[]> {
    const result = await pool.query(
      'SELECT * FROM custom_domains WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  }

  static async findByDomain(domain: string): Promise<CustomDomain | null> {
    const result = await pool.query(
      'SELECT * FROM custom_domains WHERE LOWER(domain) = LOWER($1)',
      [domain]
    );
    return result.rows[0] || null;
  }

  static async findByVerificationToken(token: string): Promise<CustomDomain | null> {
    const result = await pool.query(
      'SELECT * FROM custom_domains WHERE verification_token = $1',
      [token]
    );
    return result.rows[0] || null;
  }

  static async findActiveByDomain(domain: string): Promise<CustomDomain | null> {
    const result = await pool.query(
      'SELECT * FROM custom_domains WHERE LOWER(domain) = LOWER($1) AND is_active = TRUE AND verified = TRUE',
      [domain]
    );
    return result.rows[0] || null;
  }

  static async create(
    userId: string,
    domain: string,
    verificationToken: string,
    cnameTarget?: string | null
  ): Promise<CustomDomain> {
    const result = await pool.query(
      `INSERT INTO custom_domains (user_id, domain, verification_token, cname_target)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, domain.toLowerCase().trim(), verificationToken, cnameTarget || null]
    );
    return result.rows[0];
  }

  static async update(id: string, updates: Partial<CustomDomain>): Promise<CustomDomain> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.verified !== undefined) {
      fields.push(`verified = $${paramCount++}`);
      values.push(updates.verified);
    }
    if (updates.verified_at !== undefined) {
      fields.push(`verified_at = $${paramCount++}`);
      values.push(updates.verified_at);
    }
    if (updates.is_active !== undefined) {
      fields.push(`is_active = $${paramCount++}`);
      values.push(updates.is_active);
    }
    if (updates.cname_target !== undefined) {
      fields.push(`cname_target = $${paramCount++}`);
      values.push(updates.cname_target);
    }

    if (fields.length === 0) {
      return await this.findById(id) as CustomDomain;
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE custom_domains SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  static async findById(id: string): Promise<CustomDomain | null> {
    const result = await pool.query(
      'SELECT * FROM custom_domains WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  static async delete(id: string): Promise<void> {
    await pool.query('DELETE FROM custom_domains WHERE id = $1', [id]);
  }
}
