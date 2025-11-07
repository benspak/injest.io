import pool from '../config/database.js';
export class TaskModel {
    static async create(input) {
        const result = await pool.query(`INSERT INTO tasks (item_id, title, description, status, due_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`, [
            input.item_id,
            input.title ?? null,
            input.description ?? null,
            input.status ?? 'pending',
            input.due_date ?? null,
        ]);
        return result.rows[0];
    }
    static async findById(id) {
        const result = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
        return result.rows[0] || null;
    }
    static async findByItemId(itemId) {
        const result = await pool.query('SELECT * FROM tasks WHERE item_id = $1', [itemId]);
        return result.rows[0] || null;
    }
    static async findByOwner(ownerId, status) {
        let query = `
      SELECT t.*
      FROM tasks t
      JOIN items i ON t.item_id = i.id
      WHERE i.owner_id = $1
    `;
        const params = [ownerId];
        if (status) {
            query += ' AND t.status = $2';
            params.push(status);
        }
        query += ' ORDER BY t.created_at DESC';
        const result = await pool.query(query, params);
        return result.rows;
    }
    static async update(id, updates) {
        const fields = [];
        const values = [];
        let paramCount = 1;
        if (updates.title !== undefined) {
            fields.push(`title = $${paramCount++}`);
            values.push(updates.title ?? null);
        }
        if (updates.description !== undefined) {
            fields.push(`description = $${paramCount++}`);
            values.push(updates.description ?? null);
        }
        if (updates.status !== undefined) {
            fields.push(`status = $${paramCount++}`);
            values.push(updates.status);
        }
        if (updates.due_date !== undefined) {
            fields.push(`due_date = $${paramCount++}`);
            values.push(updates.due_date ?? null);
        }
        if (fields.length === 0) {
            const existing = await this.findById(id);
            if (!existing) {
                throw new Error('Task not found');
            }
            return existing;
        }
        values.push(id);
        const result = await pool.query(`UPDATE tasks SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`, values);
        return result.rows[0];
    }
    static async delete(id) {
        const result = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
        return result.rowCount !== null && result.rowCount > 0;
    }
}
//# sourceMappingURL=Task.js.map