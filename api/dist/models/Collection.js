import pool from '../config/database.js';
export class CollectionModel {
    static async create(input, client) {
        const executor = client ?? pool;
        const result = await executor.query(`INSERT INTO collections (owner_id, title, description, color, icon)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`, [
            input.owner_id,
            input.title,
            input.description || null,
            input.color || null,
            input.icon || null,
        ]);
        return result.rows[0];
    }
    static async findById(id) {
        const result = await pool.query('SELECT * FROM collections WHERE id = $1', [id]);
        return result.rows[0] || null;
    }
    static async findByOwner(ownerId) {
        const result = await pool.query('SELECT * FROM collections WHERE owner_id = $1 ORDER BY created_at DESC', [ownerId]);
        return result.rows;
    }
    static async update(id, updates) {
        const fields = [];
        const values = [];
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
            return await this.findById(id);
        }
        values.push(id);
        const result = await pool.query(`UPDATE collections SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`, values);
        return result.rows[0];
    }
    static async delete(id) {
        const result = await pool.query('DELETE FROM collections WHERE id = $1 RETURNING id', [id]);
        return (result.rowCount ?? 0) > 0;
    }
    static async generateShareToken(id) {
        // Generate a new UUID for the share token
        const result = await pool.query(`UPDATE collections
       SET share_token = gen_random_uuid(),
           is_publicly_shareable = true,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`, [id]);
        return result.rows[0];
    }
    static async findByShareToken(token) {
        const result = await pool.query('SELECT * FROM collections WHERE share_token = $1 AND is_publicly_shareable = true', [token]);
        return result.rows[0] || null;
    }
    static async findPostedCollectionsByOwner(ownerId, limit = 50, offset = 0) {
        const result = await pool.query('SELECT * FROM collections WHERE owner_id = $1 AND posted_to_profile = true ORDER BY created_at DESC LIMIT $2 OFFSET $3', [ownerId, limit, offset]);
        return result.rows;
    }
}
//# sourceMappingURL=Collection.js.map