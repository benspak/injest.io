import pool from '../config/database.js';

export type CommissionStatus = 'pending' | 'paid' | 'failed';

export interface ReferralCommission {
  id: string;
  referral_id: string;
  payment_intent_id: string;
  amount_cents: number;
  status: CommissionStatus;
  stripe_transfer_id: string | null;
  created_at: Date;
  paid_at: Date | null;
}

export class ReferralCommissionModel {
  static async create(
    referralId: string,
    paymentIntentId: string,
    amountCents: number,
    status: CommissionStatus = 'pending'
  ): Promise<ReferralCommission> {
    const result = await pool.query(
      `INSERT INTO referral_commissions (referral_id, payment_intent_id, amount_cents, status)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [referralId, paymentIntentId, amountCents, status]
    );
    return result.rows[0];
  }

  static async findByReferralId(referralId: string): Promise<ReferralCommission[]> {
    const result = await pool.query(
      'SELECT * FROM referral_commissions WHERE referral_id = $1 ORDER BY created_at DESC',
      [referralId]
    );
    return result.rows;
  }

  static async findById(id: string): Promise<ReferralCommission | null> {
    const result = await pool.query(
      'SELECT * FROM referral_commissions WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  static async findByPaymentIntentId(paymentIntentId: string): Promise<ReferralCommission | null> {
    const result = await pool.query(
      'SELECT * FROM referral_commissions WHERE payment_intent_id = $1',
      [paymentIntentId]
    );
    return result.rows[0] || null;
  }

  static async updateStatus(
    id: string,
    status: CommissionStatus,
    stripeTransferId?: string | null,
    paidAt?: Date | null
  ): Promise<ReferralCommission> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    updates.push(`status = $${paramCount++}`);
    values.push(status);

    if (stripeTransferId !== undefined) {
      updates.push(`stripe_transfer_id = $${paramCount++}`);
      values.push(stripeTransferId);
    }

    if (paidAt !== undefined) {
      updates.push(`paid_at = $${paramCount++}`);
      values.push(paidAt);
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE referral_commissions SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  static async getTotalEarningsByReferrerId(referrerId: string): Promise<number> {
    const result = await pool.query(
      `SELECT COALESCE(SUM(amount_cents), 0) as total
       FROM referral_commissions rc
       JOIN referrals r ON rc.referral_id = r.id
       WHERE r.referrer_id = $1 AND rc.status = 'paid'`,
      [referrerId]
    );
    return parseInt(result.rows[0].total, 10);
  }

  static async getPendingEarningsByReferrerId(referrerId: string): Promise<number> {
    const result = await pool.query(
      `SELECT COALESCE(SUM(amount_cents), 0) as total
       FROM referral_commissions rc
       JOIN referrals r ON rc.referral_id = r.id
       WHERE r.referrer_id = $1 AND rc.status = 'pending'`,
      [referrerId]
    );
    return parseInt(result.rows[0].total, 10);
  }

  static async getCommissionsByReferrerId(
    referrerId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ReferralCommission[]> {
    const result = await pool.query(
      `SELECT rc.*
       FROM referral_commissions rc
       JOIN referrals r ON rc.referral_id = r.id
       WHERE r.referrer_id = $1
       ORDER BY rc.created_at DESC
       LIMIT $2 OFFSET $3`,
      [referrerId, limit, offset]
    );
    return result.rows;
  }
}
