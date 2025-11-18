import pool from '../config/database.js';

export interface Referral {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  referral_code: string;
  created_at: Date;
}

export class ReferralModel {
  static async create(
    referrerId: string,
    referredUserId: string,
    referralCode: string
  ): Promise<Referral> {
    const result = await pool.query(
      `INSERT INTO referrals (referrer_id, referred_user_id, referral_code)
       VALUES ($1, $2, $3) RETURNING *`,
      [referrerId, referredUserId, referralCode]
    );
    return result.rows[0];
  }

  static async findByReferredUserId(referredUserId: string): Promise<Referral | null> {
    const result = await pool.query(
      'SELECT * FROM referrals WHERE referred_user_id = $1',
      [referredUserId]
    );
    return result.rows[0] || null;
  }

  static async findByReferrerId(referrerId: string): Promise<Referral[]> {
    const result = await pool.query(
      'SELECT * FROM referrals WHERE referrer_id = $1 ORDER BY created_at DESC',
      [referrerId]
    );
    return result.rows;
  }

  static async findById(id: string): Promise<Referral | null> {
    const result = await pool.query(
      'SELECT * FROM referrals WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  static async countByReferrerId(referrerId: string): Promise<number> {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM referrals WHERE referrer_id = $1',
      [referrerId]
    );
    return parseInt(result.rows[0].count, 10);
  }
}
