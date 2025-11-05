import pool from '../config/database.js';
export class CommentModel {
    static async create(input) {
        const result = await pool.query(`INSERT INTO task_comments (task_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`, [input.task_id, input.user_id, input.content]);
        return result.rows[0];
    }
    static async findById(id) {
        const result = await pool.query('SELECT * FROM task_comments WHERE id = $1', [id]);
        return result.rows[0] || null;
    }
    static async findByTaskId(taskId) {
        const result = await pool.query(`SELECT tc.*, u.email as user_email
       FROM task_comments tc
       JOIN users u ON tc.user_id = u.id
       WHERE tc.task_id = $1
       ORDER BY tc.created_at ASC`, [taskId]);
        return result.rows;
    }
    static async update(id, content) {
        const result = await pool.query(`UPDATE task_comments 
       SET content = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`, [content, id]);
        return result.rows[0];
    }
    static async delete(id) {
        const result = await pool.query('DELETE FROM task_comments WHERE id = $1', [id]);
        return result.rowCount !== null && result.rowCount > 0;
    }
    static async verifyOwnership(commentId, userId) {
        const result = await pool.query('SELECT user_id FROM task_comments WHERE id = $1', [commentId]);
        return result.rows[0]?.user_id === userId;
    }
}
//# sourceMappingURL=Comment.js.map