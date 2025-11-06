import pool from '../config/database.js';

export interface Item {
  id: string;
  owner_id: string;
  type?: 'note' | 'link' | 'file' | 'email'; // Optional for backward compatibility
  raw?: string; // Optional, kept for backward compatibility
  title?: string;
  description?: string;
  url?: string;
  attachments?: any[]; // JSONB array of file metadata
  clean?: string;
  tags?: string[];
  source?: string;
  embedding_id?: string;
  link_metadata?: any; // JSONB field for link preview metadata
  notes?: string; // User notes
  created_at: Date;
  updated_at: Date;
}

export interface CreateItemInput {
  owner_id: string;
  title?: string;
  description?: string;
  url?: string;
  attachments?: any[]; // Array of file metadata
  notes?: string;
  tags?: string[];
  source?: string;
  clean?: string;
  type?: 'note' | 'link' | 'file' | 'email'; // Optional for backward compatibility
  raw?: string; // Optional, for backward compatibility
  link_metadata?: any; // JSONB field for link preview metadata
}

export class ItemModel {
  static async create(input: CreateItemInput): Promise<Item> {
    // For new unified items, generate raw from structured data for backward compatibility
    let rawContent = input.raw;
    if (!rawContent && (input.title || input.description)) {
      rawContent = JSON.stringify({
        title: input.title || '',
        description: input.description || '',
      });
    }

    const result = await pool.query(
      `INSERT INTO items (owner_id, type, raw, title, description, url, attachments, notes, clean, tags, source, link_metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        input.owner_id,
        input.type || null,
        rawContent || null,
        input.title || null,
        input.description || null,
        input.url || null,
        input.attachments ? JSON.stringify(input.attachments) : null,
        input.notes || null,
        input.clean || null,
        input.tags || null,
        input.source || null,
        input.link_metadata || null,
      ]
    );
    return result.rows[0];
  }

  static async findById(id: string): Promise<Item | null> {
    const result = await pool.query(
      'SELECT * FROM items WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  static async findByOwner(
    ownerId: string,
    limit: number = 100,
    offset: number = 0,
    filters?: { source?: string; hasAttachments?: boolean }
  ): Promise<Item[]> {
    let query = 'SELECT * FROM items WHERE owner_id = $1';
    const params: any[] = [ownerId];
    let paramCount = 2;

    // Add source filter if provided
    if (filters?.source) {
      // For email sources, match items that start with "email:" or have type='email'
      if (filters.source === 'email') {
        query += ` AND (source LIKE $${paramCount} OR type = $${paramCount + 1})`;
        params.push('email:%');
        params.push('email');
        paramCount += 2;
      } else {
        query += ` AND source = $${paramCount++}`;
        params.push(filters.source);
      }
    }

    // Add attachments filter if provided
    if (filters?.hasAttachments === true) {
      query += ` AND attachments IS NOT NULL AND jsonb_array_length(attachments) > 0`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  static async update(id: string, updates: Partial<Item>): Promise<Item> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.title !== undefined) {
      fields.push(`title = $${paramCount++}`);
      values.push(updates.title || null);
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${paramCount++}`);
      values.push(updates.description || null);
    }
    if (updates.url !== undefined) {
      fields.push(`url = $${paramCount++}`);
      values.push(updates.url || null);
    }
    if (updates.attachments !== undefined) {
      fields.push(`attachments = $${paramCount++}`);
      values.push(updates.attachments ? JSON.stringify(updates.attachments) : null);
    }
    if (updates.notes !== undefined) {
      fields.push(`notes = $${paramCount++}`);
      values.push(updates.notes || null);
    }
    if (updates.clean !== undefined) {
      fields.push(`clean = $${paramCount++}`);
      values.push(updates.clean);
    }
    if (updates.tags !== undefined) {
      fields.push(`tags = $${paramCount++}`);
      values.push(updates.tags);
    }
    if (updates.embedding_id !== undefined) {
      fields.push(`embedding_id = $${paramCount++}`);
      values.push(updates.embedding_id);
    }
    if (updates.source !== undefined) {
      fields.push(`source = $${paramCount++}`);
      values.push(updates.source);
    }
    if (updates.link_metadata !== undefined) {
      fields.push(`link_metadata = $${paramCount++}`);
      // PostgreSQL JSONB accepts objects directly, no need to stringify
      values.push(updates.link_metadata || null);
    }

    if (fields.length === 0) {
      return await this.findById(id) as Item;
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE items SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  static async delete(id: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM items WHERE id = $1',
      [id]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  static async findByResendEmailId(resendEmailId: string): Promise<Item | null> {
    // Search for items where raw JSON contains the resend_email_id
    const result = await pool.query(
      `SELECT * FROM items
       WHERE type = 'email'
       AND raw IS NOT NULL
       AND raw::jsonb->>'resend_email_id' = $1
       LIMIT 1`,
      [resendEmailId]
    );
    return result.rows[0] || null;
  }

  static async findByOwnerAndType(ownerId: string, type: string, limit: number = 100, offset: number = 0): Promise<Item[]> {
    const result = await pool.query(
      'SELECT * FROM items WHERE owner_id = $1 AND type = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4',
      [ownerId, type, limit, offset]
    );
    return result.rows;
  }
}
