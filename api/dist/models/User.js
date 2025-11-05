import pool from '../config/database.js';
export class UserModel {
    static async findByEmail(email) {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        return result.rows[0] || null;
    }
    static async findById(id) {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        return result.rows[0] || null;
    }
    static async create(email) {
        const result = await pool.query('INSERT INTO users (email, verified) VALUES ($1, $2) RETURNING *', [email, false]);
        return result.rows[0];
    }
    static async verifyEmail(id) {
        const result = await pool.query('UPDATE users SET verified = TRUE WHERE id = $1 RETURNING *', [id]);
        return result.rows[0];
    }
    static async update(id, updates) {
        const fields = [];
        const values = [];
        let paramCount = 1;
        if (updates.email !== undefined) {
            fields.push(`email = $${paramCount++}`);
            values.push(updates.email);
        }
        if (updates.verified !== undefined) {
            fields.push(`verified = $${paramCount++}`);
            values.push(updates.verified);
        }
        if (fields.length === 0) {
            return await this.findById(id);
        }
        values.push(id);
        const result = await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`, values);
        return result.rows[0];
    }
}
//# sourceMappingURL=User.js.map