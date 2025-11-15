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
}
//# sourceMappingURL=Collection.js.map