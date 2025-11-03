import { sql } from 'drizzle-orm';
import { db } from './index.js';

/**
 * Setup script to ensure pgvector extension is installed
 * Run this before migrations if needed
 */
async function setup() {
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log('✅ pgvector extension ready');
  } catch (error) {
    console.error('Failed to setup pgvector:', error);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  setup()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { setup };
