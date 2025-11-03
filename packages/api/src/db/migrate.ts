import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './index.js';

async function runMigrations() {
  console.log('Running migrations...');
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('✅ Migrations complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

runMigrations().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
