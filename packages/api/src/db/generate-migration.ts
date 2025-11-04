import { drizzle } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

async function generateMigration() {
  const { generate } = await import('drizzle-kit');

  await generate({
    schema: './src/db/schema.ts',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: {
      url: process.env.DATABASE_URL || '',
    },
  });
}

generateMigration().catch(console.error);
