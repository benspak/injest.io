import pool from '../config/database.js';
export class SlackMessageModel {
    static async findByMessageTs(workspaceId, channelId, messageTs) {
        const result = await pool.query('SELECT * FROM slack_messages WHERE workspace_id = $1 AND channel_id = $2 AND message_ts = $3', [workspaceId, channelId, messageTs]);
        return result.rows[0] || null;
    }
    static async findByItemId(itemId) {
        const result = await pool.query('SELECT * FROM slack_messages WHERE item_id = $1 LIMIT 1', [itemId]);
        return result.rows[0] || null;
    }
    static async findByChannel(workspaceId, channelId, limit = 100) {
        const result = await pool.query('SELECT * FROM slack_messages WHERE workspace_id = $1 AND channel_id = $2 ORDER BY message_ts DESC LIMIT $3', [workspaceId, channelId, limit]);
        return result.rows;
    }
    static async findByThread(workspaceId, channelId, threadTs) {
        const result = await pool.query('SELECT * FROM slack_messages WHERE workspace_id = $1 AND channel_id = $2 AND thread_ts = $3 ORDER BY message_ts ASC', [workspaceId, channelId, threadTs]);
        return result.rows;
    }
    static async findBySlackUserId(workspaceId, slackUserId, limit = 100) {
        const result = await pool.query('SELECT * FROM slack_messages WHERE workspace_id = $1 AND slack_user_id = $2 ORDER BY message_ts DESC LIMIT $3', [workspaceId, slackUserId, limit]);
        return result.rows;
    }
    static async findUnindexed(workspaceId, limit = 100) {
        const result = await pool.query('SELECT * FROM slack_messages WHERE workspace_id = $1 AND indexed_at IS NULL ORDER BY message_ts ASC LIMIT $2', [workspaceId, limit]);
        return result.rows;
    }
    static async create(input) {
        const result = await pool.query(`INSERT INTO slack_messages (
        workspace_id, channel_id, message_ts, thread_ts, slack_user_id, text, item_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`, [
            input.workspaceId,
            input.channelId,
            input.messageTs,
            input.threadTs ?? null,
            input.slackUserId,
            input.text ?? null,
            input.itemId ?? null,
        ]);
        return result.rows[0];
    }
    static async update(workspaceId, channelId, messageTs, input) {
        const fields = [];
        const values = [];
        let paramCount = 1;
        if (input.text !== undefined) {
            fields.push(`text = $${paramCount++}`);
            values.push(input.text);
        }
        if (input.itemId !== undefined) {
            fields.push(`item_id = $${paramCount++}`);
            values.push(input.itemId);
        }
        if (input.indexedAt !== undefined) {
            fields.push(`indexed_at = $${paramCount++}`);
            values.push(input.indexedAt);
        }
        if (fields.length === 0) {
            const existing = await this.findByMessageTs(workspaceId, channelId, messageTs);
            if (!existing) {
                throw new Error('Slack message not found');
            }
            return existing;
        }
        fields.push(`updated_at = NOW()`);
        values.push(workspaceId, channelId, messageTs);
        const result = await pool.query(`UPDATE slack_messages
       SET ${fields.join(', ')}
       WHERE workspace_id = $${paramCount} AND channel_id = $${paramCount + 1} AND message_ts = $${paramCount + 2}
       RETURNING *`, values);
        if (result.rows.length === 0) {
            throw new Error('Slack message not found');
        }
        return result.rows[0];
    }
    static async createOrUpdate(input) {
        const existing = await this.findByMessageTs(input.workspaceId, input.channelId, input.messageTs);
        if (existing) {
            return this.update(input.workspaceId, input.channelId, input.messageTs, {
                text: input.text,
                itemId: input.itemId,
            });
        }
        return this.create(input);
    }
    static async delete(workspaceId, channelId, messageTs) {
        const result = await pool.query('DELETE FROM slack_messages WHERE workspace_id = $1 AND channel_id = $2 AND message_ts = $3 RETURNING id', [workspaceId, channelId, messageTs]);
        return result.rows.length > 0;
    }
}
//# sourceMappingURL=SlackMessage.js.map