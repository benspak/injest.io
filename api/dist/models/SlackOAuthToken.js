import pool from '../config/database.js';
import { encrypt, decryptField } from '../utils/encryption.js';
export class SlackOAuthTokenModel {
    /**
     * Decrypt token fields from database result
     */
    static decryptToken(token) {
        if (!token) {
            return token;
        }
        return {
            ...token,
            access_token: decryptField(token.access_token) || '',
            authed_user_token: decryptField(token.authed_user_token),
        };
    }
    /**
     * Decrypt array of tokens
     */
    static decryptTokens(tokens) {
        return tokens.map(token => this.decryptToken(token));
    }
    static async findByUserId(userId) {
        const result = await pool.query('SELECT * FROM slack_oauth_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId]);
        if (!result.rows[0]) {
            return null;
        }
        return this.decryptToken(result.rows[0]);
    }
    static async findAllByUserId(userId) {
        const result = await pool.query('SELECT * FROM slack_oauth_tokens WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return this.decryptTokens(result.rows);
    }
    static async findByUserIdAndWorkspace(userId, workspaceId) {
        const result = await pool.query('SELECT * FROM slack_oauth_tokens WHERE user_id = $1 AND workspace_id = $2', [userId, workspaceId]);
        if (!result.rows[0]) {
            return null;
        }
        return this.decryptToken(result.rows[0]);
    }
    static async findByWorkspaceId(workspaceId) {
        const result = await pool.query('SELECT * FROM slack_oauth_tokens WHERE workspace_id = $1', [workspaceId]);
        return this.decryptTokens(result.rows);
    }
    static async findById(id) {
        const result = await pool.query('SELECT * FROM slack_oauth_tokens WHERE id = $1', [id]);
        if (!result.rows[0]) {
            return null;
        }
        return this.decryptToken(result.rows[0]);
    }
    static async create(input) {
        // Encrypt tokens before storing
        const encryptedAccessToken = encrypt(input.accessToken);
        const encryptedAuthedUserToken = input.authedUserToken ? encrypt(input.authedUserToken) : null;
        const result = await pool.query(`INSERT INTO slack_oauth_tokens (
        user_id, workspace_id, access_token, bot_user_id, scope, authed_user_id, authed_user_token
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`, [
            input.userId,
            input.workspaceId,
            encryptedAccessToken,
            input.botUserId ?? null,
            input.scope ?? null,
            input.authedUserId ?? null,
            encryptedAuthedUserToken,
        ]);
        return this.decryptToken(result.rows[0]);
    }
    static async update(userId, workspaceId, input) {
        const fields = [];
        const values = [];
        let paramCount = 1;
        if (input.accessToken !== undefined) {
            fields.push(`access_token = $${paramCount++}`);
            values.push(encrypt(input.accessToken));
        }
        if (input.botUserId !== undefined) {
            fields.push(`bot_user_id = $${paramCount++}`);
            values.push(input.botUserId);
        }
        if (input.scope !== undefined) {
            fields.push(`scope = $${paramCount++}`);
            values.push(input.scope);
        }
        if (input.authedUserId !== undefined) {
            fields.push(`authed_user_id = $${paramCount++}`);
            values.push(input.authedUserId);
        }
        if (input.authedUserToken !== undefined) {
            fields.push(`authed_user_token = $${paramCount++}`);
            values.push(input.authedUserToken ? encrypt(input.authedUserToken) : null);
        }
        if (fields.length === 0) {
            const existing = await this.findByUserIdAndWorkspace(userId, workspaceId);
            if (!existing) {
                throw new Error('Slack OAuth token not found');
            }
            return existing;
        }
        fields.push(`updated_at = NOW()`);
        values.push(userId, workspaceId);
        const result = await pool.query(`UPDATE slack_oauth_tokens
       SET ${fields.join(', ')}
       WHERE user_id = $${paramCount} AND workspace_id = $${paramCount + 1}
       RETURNING *`, values);
        if (result.rows.length === 0) {
            throw new Error('Slack OAuth token not found');
        }
        return this.decryptToken(result.rows[0]);
    }
    static async createOrUpdate(userId, input) {
        const existing = await this.findByUserIdAndWorkspace(userId, input.workspaceId);
        if (existing) {
            return this.update(userId, input.workspaceId, {
                accessToken: input.accessToken,
                botUserId: input.botUserId,
                scope: input.scope,
                authedUserId: input.authedUserId,
                authedUserToken: input.authedUserToken,
            });
        }
        return this.create(input);
    }
    static async delete(userId) {
        const result = await pool.query('DELETE FROM slack_oauth_tokens WHERE user_id = $1 RETURNING id', [userId]);
        return result.rows.length > 0;
    }
    static async deleteByWorkspace(userId, workspaceId) {
        const result = await pool.query('DELETE FROM slack_oauth_tokens WHERE user_id = $1 AND workspace_id = $2 RETURNING id', [userId, workspaceId]);
        return result.rows.length > 0;
    }
}
//# sourceMappingURL=SlackOAuthToken.js.map