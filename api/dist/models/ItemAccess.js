import pool from '../config/database.js';
import { UserModel } from './User.js';
const normalizeEmail = (value) => value.trim().toLowerCase();
export class ItemAccessModel {
    static async grantAccess(itemId, email, options = {}) {
        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            throw new Error('Email is required to grant access');
        }
        const normalized = normalizeEmail(trimmedEmail);
        const existingUser = await UserModel.findByEmail(trimmedEmail);
        await pool.query(`
        INSERT INTO item_access (item_id, email, normalized_email, user_id, granted_by)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (item_id, normalized_email)
        DO UPDATE SET
          email = EXCLUDED.email,
          user_id = COALESCE(EXCLUDED.user_id, item_access.user_id),
          granted_by = EXCLUDED.granted_by,
          updated_at = CURRENT_TIMESTAMP
      `, [itemId, trimmedEmail, normalized, existingUser?.id ?? null, options.grantedByUserId ?? null]);
    }
    static async userHasAccess(itemId, userId, email) {
        const normalized = email ? normalizeEmail(email) : null;
        const params = [itemId, userId];
        let emailClause = '';
        if (normalized) {
            params.push(normalized);
            emailClause = ' OR normalized_email = $3';
        }
        const result = await pool.query(`
        SELECT 1
        FROM item_access
        WHERE item_id = $1
          AND (
            user_id = $2${emailClause}
          )
        LIMIT 1
      `, params);
        return (result.rowCount ?? 0) > 0;
    }
    static async linkUserToEmail(userId, email) {
        const normalized = normalizeEmail(email);
        await pool.query(`
        UPDATE item_access
        SET user_id = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE normalized_email = $2
          AND (user_id IS NULL OR user_id <> $1)
      `, [userId, normalized]);
    }
}
export const itemAccessEmailNormalizer = normalizeEmail;
//# sourceMappingURL=ItemAccess.js.map