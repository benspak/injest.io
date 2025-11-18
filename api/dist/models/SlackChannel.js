import pool from '../config/database.js';
export class SlackChannelModel {
    static async findByChannelId(workspaceId, channelId) {
        const result = await pool.query('SELECT * FROM slack_channels WHERE workspace_id = $1 AND channel_id = $2', [workspaceId, channelId]);
        return result.rows[0] || null;
    }
    static async findByWorkspaceId(workspaceId) {
        const result = await pool.query('SELECT * FROM slack_channels WHERE workspace_id = $1 ORDER BY channel_name ASC', [workspaceId]);
        return result.rows;
    }
    static async findById(id) {
        const result = await pool.query('SELECT * FROM slack_channels WHERE id = $1', [id]);
        return result.rows[0] || null;
    }
    static async create(input) {
        const result = await pool.query(`INSERT INTO slack_channels (
        workspace_id, channel_id, channel_name, channel_type, is_private, is_archived
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`, [
            input.workspaceId,
            input.channelId,
            input.channelName ?? null,
            input.channelType ?? null,
            input.isPrivate ?? false,
            input.isArchived ?? false,
        ]);
        return result.rows[0];
    }
    static async update(workspaceId, channelId, input) {
        const fields = [];
        const values = [];
        let paramCount = 1;
        if (input.channelName !== undefined) {
            fields.push(`channel_name = $${paramCount++}`);
            values.push(input.channelName);
        }
        if (input.channelType !== undefined) {
            fields.push(`channel_type = $${paramCount++}`);
            values.push(input.channelType);
        }
        if (input.isPrivate !== undefined) {
            fields.push(`is_private = $${paramCount++}`);
            values.push(input.isPrivate);
        }
        if (input.isArchived !== undefined) {
            fields.push(`is_archived = $${paramCount++}`);
            values.push(input.isArchived);
        }
        if (fields.length === 0) {
            const existing = await this.findByChannelId(workspaceId, channelId);
            if (!existing) {
                throw new Error('Slack channel not found');
            }
            return existing;
        }
        fields.push(`updated_at = NOW()`);
        values.push(workspaceId, channelId);
        const result = await pool.query(`UPDATE slack_channels
       SET ${fields.join(', ')}
       WHERE workspace_id = $${paramCount} AND channel_id = $${paramCount + 1}
       RETURNING *`, values);
        if (result.rows.length === 0) {
            throw new Error('Slack channel not found');
        }
        return result.rows[0];
    }
    static async createOrUpdate(input) {
        const existing = await this.findByChannelId(input.workspaceId, input.channelId);
        if (existing) {
            return this.update(input.workspaceId, input.channelId, {
                channelName: input.channelName,
                channelType: input.channelType,
                isPrivate: input.isPrivate,
                isArchived: input.isArchived,
            });
        }
        return this.create(input);
    }
    static async delete(workspaceId, channelId) {
        const result = await pool.query('DELETE FROM slack_channels WHERE workspace_id = $1 AND channel_id = $2 RETURNING id', [workspaceId, channelId]);
        return result.rows.length > 0;
    }
}
//# sourceMappingURL=SlackChannel.js.map