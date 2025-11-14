import pool from '../config/database.js';
export class LoginSessionModel {
    static async create(userId, loginAt) {
        const loginTimestamp = loginAt || new Date();
        const result = await pool.query('INSERT INTO login_sessions (user_id, login_at) VALUES ($1, $2) RETURNING *', [userId, loginTimestamp]);
        return result.rows[0];
    }
    static async findByUserId(userId, limit = 20, offset = 0) {
        const result = await pool.query('SELECT * FROM login_sessions WHERE user_id = $1 ORDER BY login_at DESC LIMIT $2 OFFSET $3', [userId, limit, offset]);
        return result.rows;
    }
    static async countByUserId(userId) {
        const result = await pool.query('SELECT COUNT(*) as count FROM login_sessions WHERE user_id = $1', [userId]);
        return parseInt(result.rows[0].count, 10);
    }
    static async getLoginStreak(userId) {
        // Get the start of the current week (Monday) in UTC
        const now = new Date();
        const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const startOfWeek = new Date(now);
        startOfWeek.setUTCDate(now.getUTCDate() - daysToMonday);
        startOfWeek.setUTCHours(0, 0, 0, 0);
        // Get the end of the current week (Sunday) in UTC
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6);
        endOfWeek.setUTCHours(23, 59, 59, 999);
        // Query for unique days in the current week (using UTC)
        const result = await pool.query(`SELECT DISTINCT DATE(login_at AT TIME ZONE 'UTC') as login_date
       FROM login_sessions
       WHERE user_id = $1
         AND login_at >= $2
         AND login_at <= $3
       ORDER BY login_date DESC`, [userId, startOfWeek, endOfWeek]);
        const weekDays = [];
        result.rows.forEach((row) => {
            const loginDate = new Date(row.login_date);
            const dayOfWeek = loginDate.getUTCDay();
            // Convert Sunday (0) to 7 for easier handling, Monday = 1, Tuesday = 2, etc.
            const normalizedDay = dayOfWeek === 0 ? 7 : dayOfWeek;
            if (!weekDays.includes(normalizedDay)) {
                weekDays.push(normalizedDay);
            }
        });
        // Sort weekDays array
        weekDays.sort((a, b) => a - b);
        return {
            currentStreak: weekDays.length,
            weekDays,
        };
    }
}
//# sourceMappingURL=LoginSession.js.map