import { PoolClient } from 'pg';
import pool from '../config/database.js';

export interface Collection {
  id: string;
  owner_id: string;
  title: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateCollectionInput {
  owner_id: string;
  title: string;
  description?: string;
  color?: string;
  icon?: string;
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
}
