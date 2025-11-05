import pool from '../config/database.js';
async function resetDatabase() {
    try {
        console.log('Dropping all tables...');
        // Drop tables in reverse order of dependencies (respecting foreign keys)
        await pool.query('DROP TABLE IF EXISTS tasks CASCADE');
        await pool.query('DROP TABLE IF EXISTS embeddings CASCADE');
        await pool.query('DROP TABLE IF EXISTS items CASCADE');
        await pool.query('DROP TABLE IF EXISTS users CASCADE');
        console.log('All tables dropped successfully');
        console.log('Now run migrations to recreate schema...');
        process.exit(0);
    }
    catch (error) {
        console.error('Error resetting database:', error);
        process.exit(1);
    }
}
resetDatabase();
//# sourceMappingURL=reset.js.map