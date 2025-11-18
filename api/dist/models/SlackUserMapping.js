import pool from '../config/database.js';
export class SlackUserMappingModel {
    static async findBySlackUserId(userId, workspaceId, slackUserId) {
        const result = await pool.query('SELECT * FROM slack_user_mappings WHERE user_id = $1 AND workspace_id = $2 AND slack_user_id = $3', [userId, workspaceId, slackUserId]);
        return result.rows[0] || null;
    }
    static async findByContactId(userId, contactId) {
        const result = await pool.query('SELECT * FROM slack_user_mappings WHERE user_id = $1 AND contact_id = $2', [userId, contactId]);
        return result.rows;
    }
    static async findByWorkspaceId(userId, workspaceId) {
        const result = await pool.query('SELECT * FROM slack_user_mappings WHERE user_id = $1 AND workspace_id = $2', [userId, workspaceId]);
        return result.rows;
    }
    static async findById(id) {
        const result = await pool.query('SELECT * FROM slack_user_mappings WHERE id = $1', [id]);
        return result.rows[0] || null;
    }
    static async create(input) {
        const result = await pool.query(`INSERT INTO slack_user_mappings (
        user_id, workspace_id, slack_user_id, contact_id, slack_username, slack_email
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`, [
            input.userId,
            input.workspaceId,
            input.slackUserId,
            input.contactId ?? null,
            input.slackUsername ?? null,
            input.slackEmail ?? null,
        ]);
        return result.rows[0];
    }
    static async update(userId, workspaceId, slackUserId, input) {
        const fields = [];
        const values = [];
        let paramCount = 1;
        if (input.contactId !== undefined) {
            fields.push(`contact_id = $${paramCount++}`);
            values.push(input.contactId);
        }
        if (input.slackUsername !== undefined) {
            fields.push(`slack_username = $${paramCount++}`);
            values.push(input.slackUsername);
        }
        if (input.slackEmail !== undefined) {
            fields.push(`slack_email = $${paramCount++}`);
            values.push(input.slackEmail);
        }
        if (fields.length === 0) {
            const existing = await this.findBySlackUserId(userId, workspaceId, slackUserId);
            if (!existing) {
                throw new Error('Slack user mapping not found');
            }
            return existing;
        }
        fields.push(`updated_at = NOW()`);
        values.push(userId, workspaceId, slackUserId);
        const result = await pool.query(`UPDATE slack_user_mappings
       SET ${fields.join(', ')}
       WHERE user_id = $${paramCount} AND workspace_id = $${paramCount + 1} AND slack_user_id = $${paramCount + 2}
       RETURNING *`, values);
        if (result.rows.length === 0) {
            throw new Error('Slack user mapping not found');
        }
        return result.rows[0];
    }
    static async createOrUpdate(input) {
        const existing = await this.findBySlackUserId(input.userId, input.workspaceId, input.slackUserId);
        if (existing) {
            return this.update(input.userId, input.workspaceId, input.slackUserId, {
                contactId: input.contactId,
                slackUsername: input.slackUsername,
                slackEmail: input.slackEmail,
            });
        }
        return this.create(input);
    }
    static async delete(userId, workspaceId, slackUserId) {
        const result = await pool.query('DELETE FROM slack_user_mappings WHERE user_id = $1 AND workspace_id = $2 AND slack_user_id = $3 RETURNING id', [userId, workspaceId, slackUserId]);
        return result.rows.length > 0;
    }
}
//# sourceMappingURL=SlackUserMapping.js.map