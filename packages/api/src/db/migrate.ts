import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './index.js';

async function runMigrations() {
  console.log('Running migrations...');
  // Path is relative to where the script runs from (dist/db/)
  // Go up to package root and then into drizzle folder
  const migrationsPath = process.env.MIGRATIONS_PATH || '../../drizzle';
  await migrate(db, { migrationsFolder: migrationsPath });
  console.log('Migrations completed!');
  process.exit(0);
}

runMigrations().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
