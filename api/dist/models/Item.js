import pool from '../config/database.js';
export class ItemModel {
    static async create(input) {
        // For new unified items, generate raw from structured data for backward compatibility
        let rawContent = input.raw;
        if (!rawContent && (input.title || input.description)) {
            rawContent = JSON.stringify({
                title: input.title || '',
                description: input.description || '',
            });
        }
        const result = await pool.query(`INSERT INTO items (owner_id, type, raw, title, description, url, attachments, notes, clean, tags, source, link_metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`, [
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
        ]);
        return result.rows[0];
    }
    static async findById(id) {
        const result = await pool.query('SELECT * FROM items WHERE id = $1 AND deleted_at IS NULL', [id]);
        return result.rows[0] || null;
    }
    static async findByIdIncludingDeleted(id) {
        const result = await pool.query('SELECT * FROM items WHERE id = $1', [id]);
        return result.rows[0] || null;
    }
    static async findByOwner(ownerId, limit = 100, offset = 0, filters) {
        let query = 'SELECT * FROM items WHERE owner_id = $1 AND deleted_at IS NULL';
        const params = [ownerId];
        let paramCount = 2;
        // Add source filter if provided
        if (filters?.source) {
            // For email sources, match items that start with "email:" or have type='email'
            if (filters.source === 'email') {
                query += ` AND (source LIKE $${paramCount} OR type = $${paramCount + 1})`;
                params.push('email:%');
                params.push('email');
                paramCount += 2;
            }
            else {
                query += ` AND source = $${paramCount++}`;
                params.push(filters.source);
            }
        }
        // Add attachments filter if provided
        if (filters?.hasAttachments === true) {
            query += ` AND attachments IS NOT NULL AND jsonb_array_length(attachments) > 0`;
        }
        // Add file type filter if provided
        if (filters?.fileType) {
            const fileType = filters.fileType.toLowerCase();
            if (fileType === 'image') {
                // Match items with attachments that have image/* MIME types
                query += ` AND attachments IS NOT NULL AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(attachments) AS attachment
          WHERE (attachment->>'mimetype')::text LIKE 'image/%'
        )`;
            }
            else if (fileType === 'spreadsheet') {
                // Match items with attachments that have spreadsheet MIME types
                query += ` AND attachments IS NOT NULL AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(attachments) AS attachment
          WHERE (attachment->>'mimetype')::text IN (
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.oasis.opendocument.spreadsheet',
            'text/csv',
            'application/csv'
          ) OR (attachment->>'mimetype')::text LIKE 'application/vnd.ms-excel%'
          OR (attachment->>'mimetype')::text LIKE 'application/vnd.openxmlformats-officedocument.spreadsheetml%'
        )`;
            }
            else if (fileType === 'document') {
                // Match items with attachments that have document MIME types
                query += ` AND attachments IS NOT NULL AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(attachments) AS attachment
          WHERE (attachment->>'mimetype')::text IN (
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.oasis.opendocument.text',
            'text/plain',
            'text/rtf'
          ) OR (attachment->>'mimetype')::text LIKE 'application/pdf%'
          OR (attachment->>'mimetype')::text LIKE 'application/msword%'
          OR (attachment->>'mimetype')::text LIKE 'application/vnd.openxmlformats-officedocument.wordprocessingml%'
          OR (attachment->>'mimetype')::text LIKE 'text/plain%'
        )`;
            }
        }
        query += ` ORDER BY created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
        params.push(limit, offset);
        const result = await pool.query(query, params);
        return result.rows;
    }
    static async update(id, updates) {
        const fields = [];
        const values = [];
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
        if (updates.type !== undefined) {
            fields.push(`type = $${paramCount++}`);
            values.push(updates.type || null);
        }
        if (fields.length === 0) {
            return await this.findById(id);
        }
        values.push(id);
        const result = await pool.query(`UPDATE items SET ${fields.join(', ')} WHERE id = $${paramCount} AND deleted_at IS NULL RETURNING *`, values);
        return result.rows[0];
    }
    static async delete(id) {
        // Soft delete: set deleted_at timestamp instead of actually deleting
        const result = await pool.query('UPDATE items SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL', [id]);
        return result.rowCount !== null && result.rowCount > 0;
    }
    static async findByResendEmailId(resendEmailId) {
        // Search for items where raw JSON contains the resend_email_id
        // Include deleted items to check if email was previously deleted
        const result = await pool.query(`SELECT * FROM items
       WHERE type = 'email'
       AND raw IS NOT NULL
       AND raw::jsonb->>'resend_email_id' = $1
       LIMIT 1`, [resendEmailId]);
        return result.rows[0] || null;
    }
    static async findByOwnerAndType(ownerId, type, limit = 100, offset = 0) {
        const result = await pool.query('SELECT * FROM items WHERE owner_id = $1 AND type = $2 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $3 OFFSET $4', [ownerId, type, limit, offset]);
        return result.rows;
    }
}
//# sourceMappingURL=Item.js.map