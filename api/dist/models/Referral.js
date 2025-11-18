import pool from '../config/database.js';
export class ReferralModel {
    static async create(referrerId, referredUserId, referralCode) {
        const result = await pool.query(`INSERT INTO referrals (referrer_id, referred_user_id, referral_code)
       VALUES ($1, $2, $3) RETURNING *`, [referrerId, referredUserId, referralCode]);
        return result.rows[0];
    }
    static async findByReferredUserId(referredUserId) {
        const result = await pool.query('SELECT * FROM referrals WHERE referred_user_id = $1', [referredUserId]);
        return result.rows[0] || null;
    }
    static async findByReferrerId(referrerId) {
        const result = await pool.query('SELECT * FROM referrals WHERE referrer_id = $1 ORDER BY created_at DESC', [referrerId]);
        return result.rows;
    }
    static async findById(id) {
        const result = await pool.query('SELECT * FROM referrals WHERE id = $1', [id]);
        return result.rows[0] || null;
    }
    static async countByReferrerId(referrerId) {
        const result = await pool.query('SELECT COUNT(*) as count FROM referrals WHERE referrer_id = $1', [referrerId]);
        return parseInt(result.rows[0].count, 10);
    }
}
//# sourceMappingURL=Referral.js.map