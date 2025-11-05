import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});
// Test connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error:', err);
    }
    else {
        console.log('Database connected successfully');
    }
});
// Enable pgvector extension on connection
pool.query('CREATE EXTENSION IF NOT EXISTS vector', (err) => {
    if (err && !err.message.includes('already exists')) {
        console.error('Error enabling pgvector extension:', err);
    }
});
export default pool;
//# sourceMappingURL=database.js.map