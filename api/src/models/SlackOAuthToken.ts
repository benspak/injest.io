import pool from '../config/database.js';

export interface SlackOAuthToken {
  id: string;
  user_id: string;
  workspace_id: string;
  access_token: string;
  bot_user_id: string | null;
  scope: string | null;
  authed_user_id: string | null;
  authed_user_token: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSlackOAuthTokenInput {
  userId: string;
  workspaceId: string;
  accessToken: string;
  botUserId?: string | null;
  scope?: string | null;
  authedUserId?: string | null;
  authedUserToken?: string | null;
}

export interface UpdateSlackOAuthTokenInput {
  accessToken?: string;
  botUserId?: string | null;
  scope?: string | null;
  authedUserId?: string | null;
  authedUserToken?: string | null;
}

export class SlackOAuthTokenModel {
  static async findByUserId(userId: string): Promise<SlackOAuthToken | null> {
    const result = await pool.query(
      'SELECT * FROM slack_oauth_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
    return result.rows[0] || null;
  }

  static async findByUserIdAndWorkspace(userId: string, workspaceId: string): Promise<SlackOAuthToken | null> {
    const result = await pool.query(
      'SELECT * FROM slack_oauth_tokens WHERE user_id = $1 AND workspace_id = $2',
      [userId, workspaceId]
    );
    return result.rows[0] || null;
  }

  static async findByWorkspaceId(workspaceId: string): Promise<SlackOAuthToken[]> {
    const result = await pool.query(
      'SELECT * FROM slack_oauth_tokens WHERE workspace_id = $1',
      [workspaceId]
    );
    return result.rows;
  }

  static async findById(id: string): Promise<SlackOAuthToken | null> {
    const result = await pool.query(
      'SELECT * FROM slack_oauth_tokens WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  static async create(input: CreateSlackOAuthTokenInput): Promise<SlackOAuthToken> {
    const result = await pool.query(
      `INSERT INTO slack_oauth_tokens (
        user_id, workspace_id, access_token, bot_user_id, scope, authed_user_id, authed_user_token
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        input.userId,
        input.workspaceId,
        input.accessToken,
        input.botUserId ?? null,
        input.scope ?? null,
        input.authedUserId ?? null,
        input.authedUserToken ?? null,
      ]
    );
    return result.rows[0];
  }

  static async update(userId: string, workspaceId: string, input: UpdateSlackOAuthTokenInput): Promise<SlackOAuthToken> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    if (input.accessToken !== undefined) {
      fields.push(`access_token = $${paramCount++}`);
      values.push(input.accessToken);
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
      values.push(input.authedUserToken);
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

    const result = await pool.query(
      `UPDATE slack_oauth_tokens
       SET ${fields.join(', ')}
       WHERE user_id = $${paramCount} AND workspace_id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('Slack OAuth token not found');
    }

    return result.rows[0];
  }

  static async createOrUpdate(userId: string, input: CreateSlackOAuthTokenInput): Promise<SlackOAuthToken> {
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

  static async delete(userId: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM slack_oauth_tokens WHERE user_id = $1 RETURNING id',
      [userId]
    );
    return result.rows.length > 0;
  }

  static async deleteByWorkspace(userId: string, workspaceId: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM slack_oauth_tokens WHERE user_id = $1 AND workspace_id = $2 RETURNING id',
      [userId, workspaceId]
    );
    return result.rows.length > 0;
  }
}
