import pool from '../config/database.js';
export class SlackWorkspaceModel {
    static async findByWorkspaceId(workspaceId) {
        const result = await pool.query('SELECT * FROM slack_workspaces WHERE workspace_id = $1', [workspaceId]);
        return result.rows[0] || null;
    }
    static async findByUserId(userId) {
        const result = await pool.query('SELECT * FROM slack_workspaces WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return result.rows;
    }
    static async findById(id) {
        const result = await pool.query('SELECT * FROM slack_workspaces WHERE id = $1', [id]);
        return result.rows[0] || null;
    }
    static async create(input) {
        const result = await pool.query(`INSERT INTO slack_workspaces (
        workspace_id, workspace_name, domain, user_id
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`, [
            input.workspaceId,
            input.workspaceName ?? null,
            input.domain ?? null,
            input.userId,
        ]);
        return result.rows[0];
    }
    static async update(workspaceId, input) {
        const fields = [];
        const values = [];
        let paramCount = 1;
        if (input.workspaceName !== undefined) {
            fields.push(`workspace_name = $${paramCount++}`);
            values.push(input.workspaceName);
        }
        if (input.domain !== undefined) {
            fields.push(`domain = $${paramCount++}`);
            values.push(input.domain);
        }
        if (fields.length === 0) {
            const existing = await this.findByWorkspaceId(workspaceId);
            if (!existing) {
                throw new Error('Slack workspace not found');
            }
            return existing;
        }
        fields.push(`updated_at = NOW()`);
        values.push(workspaceId);
        const result = await pool.query(`UPDATE slack_workspaces
       SET ${fields.join(', ')}
       WHERE workspace_id = $${paramCount}
       RETURNING *`, values);
        if (result.rows.length === 0) {
            throw new Error('Slack workspace not found');
        }
        return result.rows[0];
    }
    static async createOrUpdate(input) {
        const existing = await this.findByWorkspaceId(input.workspaceId);
        if (existing) {
            return this.update(input.workspaceId, {
                workspaceName: input.workspaceName,
                domain: input.domain,
            });
        }
        return this.create(input);
    }
    static async delete(workspaceId) {
        const result = await pool.query('DELETE FROM slack_workspaces WHERE workspace_id = $1 RETURNING id', [workspaceId]);
        return result.rows.length > 0;
    }
}
//# sourceMappingURL=SlackWorkspace.js.map