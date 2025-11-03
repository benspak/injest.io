/**
 * Generate a new migration after schema changes
 * Run: pnpm db:generate
 */

import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './index.js';

async function generate() {
  console.log('Generating migration...');
  // This is typically done via drizzle-kit CLI, but we can trigger it programmatically
  console.log('Run: pnpm db:generate (drizzle-kit generate)');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generate().catch(console.error);
}

export { generate };
