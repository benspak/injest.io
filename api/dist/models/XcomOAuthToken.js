import pool from '../config/database.js';
export class XcomOAuthTokenModel {
    static async findByUserId(userId) {
        const result = await pool.query('SELECT * FROM xcom_oauth_tokens WHERE user_id = $1', [userId]);
        return result.rows[0] || null;
    }
    static async findById(id) {
        const result = await pool.query('SELECT * FROM xcom_oauth_tokens WHERE id = $1', [id]);
        return result.rows[0] || null;
    }
    static async create(input) {
        const result = await pool.query(`INSERT INTO xcom_oauth_tokens (
        user_id, access_token, refresh_token, token_type, expires_at, scope, x_user_id, x_username
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`, [
            input.userId,
            input.accessToken,
            input.refreshToken ?? null,
            input.tokenType ?? 'Bearer',
            input.expiresAt ?? null,
            input.scope ?? null,
            input.xUserId ?? null,
            input.xUsername ?? null,
        ]);
        return result.rows[0];
    }
    static async update(userId, input) {
        const fields = [];
        const values = [];
        let paramCount = 1;
        if (input.accessToken !== undefined) {
            fields.push(`access_token = $${paramCount++}`);
            values.push(input.accessToken);
        }
        if (input.refreshToken !== undefined) {
            fields.push(`refresh_token = $${paramCount++}`);
            values.push(input.refreshToken);
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
        const result = await pool.query(`UPDATE xcom_oauth_tokens
       SET ${fields.join(', ')}
       WHERE user_id = $${paramCount}
       RETURNING *`, values);
        if (result.rows.length === 0) {
            throw new Error('X.com OAuth token not found');
        }
        return result.rows[0];
    }
    static async createOrUpdate(userId, input) {
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
    static async delete(userId) {
        const result = await pool.query('DELETE FROM xcom_oauth_tokens WHERE user_id = $1 RETURNING id', [userId]);
        return result.rows.length > 0;
    }
    static async isTokenValid(token) {
        if (!token.expires_at) {
            // If no expiration, assume token is valid
            return true;
        }
        const now = new Date();
        return new Date(token.expires_at) > now;
    }
    static async findByXUserId(xUserId) {
        const result = await pool.query('SELECT * FROM xcom_oauth_tokens WHERE x_user_id = $1', [xUserId]);
        return result.rows[0] || null;
    }
}
//# sourceMappingURL=XcomOAuthToken.js.map