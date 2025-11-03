/**
 * Post-deployment script to enable pgvector extension
 * Run this after database is created on Render
 */
import 'dotenv/config';
import { db } from './index.js';
import { sql } from 'drizzle-orm';

async function postDeploy() {
  try {
    console.log('🔧 Enabling pgvector extension...');
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log('✅ pgvector extension enabled');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to enable pgvector:', error);
    process.exit(1);
  }
}

postDeploy();
