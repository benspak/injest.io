import { PoolClient } from 'pg';
import pool from '../config/database.js';

export interface Collection {
  id: string;
  owner_id: string;
  title: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  posted_to_profile?: boolean;
  is_publicly_shareable?: boolean;
  share_token?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateCollectionInput {
  owner_id: string;
  title: string;
  description?: string;
  color?: string;
  icon?: string;
  posted_to_profile?: boolean;
  is_publicly_shareable?: boolean;
}

export class CollectionModel {
  static async create(input: CreateCollectionInput, client?: PoolClient): Promise<Collection> {
    const executor = client ?? pool;

    const result = await executor.query(
      `INSERT INTO collections (owner_id, title, description, color, icon)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        input.owner_id,
        input.title,
        input.description || null,
        input.color || null,
        input.icon || null,
      ]
    );
    return result.rows[0] as Collection;
  }

  static async findById(id: string): Promise<Collection | null> {
    const result = await pool.query(
      'SELECT * FROM collections WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  static async findByOwner(ownerId: string): Promise<Collection[]> {
    const result = await pool.query(
      'SELECT * FROM collections WHERE owner_id = $1 ORDER BY created_at DESC',
      [ownerId]
    );
    return result.rows;
  }

  static async update(id: string, updates: Partial<Collection>): Promise<Collection> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.title !== undefined) {
      fields.push(`title = $${paramCount++}`);
      values.push(updates.title);
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${paramCount++}`);
      values.push(updates.description || null);
    }
    if (updates.color !== undefined) {
      fields.push(`color = $${paramCount++}`);
      values.push(updates.color || null);
    }
    if (updates.icon !== undefined) {
      fields.push(`icon = $${paramCount++}`);
      values.push(updates.icon || null);
    }
    if (updates.posted_to_profile !== undefined) {
      fields.push(`posted_to_profile = $${paramCount++}`);
      values.push(updates.posted_to_profile || false);
    }
    if (updates.is_publicly_shareable !== undefined) {
      fields.push(`is_publicly_shareable = $${paramCount++}`);
      values.push(updates.is_publicly_shareable || false);
    }
    if (updates.share_token !== undefined) {
      fields.push(`share_token = $${paramCount++}`);
      values.push(updates.share_token || null);
    }

    if (fields.length === 0) {
      return await this.findById(id) as Collection;
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE collections SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  static async delete(id: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM collections WHERE id = $1 RETURNING id',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  static async generateShareToken(id: string): Promise<Collection> {
    // Generate a new UUID for the share token
    const result = await pool.query(
      `UPDATE collections
       SET share_token = gen_random_uuid(),
           is_publicly_shareable = true,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return result.rows[0] as Collection;
  }

  static async findByShareToken(token: string): Promise<Collection | null> {
    const result = await pool.query(
      'SELECT * FROM collections WHERE share_token = $1 AND is_publicly_shareable = true',
      [token]
    );
    return result.rows[0] || null;
  }

  static async findPostedCollectionsByOwner(
    ownerId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Collection[]> {
    const result = await pool.query(
      'SELECT * FROM collections WHERE owner_id = $1 AND posted_to_profile = true ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [ownerId, limit, offset]
    );
    return result.rows;
  }
}
