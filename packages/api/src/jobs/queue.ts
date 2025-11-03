import { Queue, Worker } from 'bullmq';
import { generateEmbedding, classifyAndExtract } from '../services/openai.js';
import { db } from '../db/index.js';
import { items } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

const redisConnection = process.env.REDIS_URL || {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

export const indexingQueue = new Queue('indexing', { connection: redisConnection });
export const processingQueue = new Queue('processing', { connection: redisConnection });

// Worker to process items and generate embeddings
export const indexingWorker = new Worker(
  'indexing',
  async (job) => {
    const { itemId } = job.data;

    const [item] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);

    if (!item) {
      throw new Error(`Item ${itemId} not found`);
    }

    // Generate embedding from clean text or raw text
    const textForEmbedding = item.clean || item.raw;
    const embedding = await generateEmbedding(textForEmbedding);
    const embeddingArray = `[${embedding.join(',')}]`;

    // Update item with embedding using raw SQL for pgvector
    await db.execute(sql`
      UPDATE items
      SET
        embedding = ${embeddingArray}::vector,
        embedding_id = ${`vec_${itemId}`}
      WHERE id = ${itemId}
    `);

    console.log(`Indexed item ${itemId}`);
  },
  { connection: redisConnection }
);

// Worker to auto-structure items
export const processingWorker = new Worker(
  'processing',
  async (job) => {
    const { itemId } = job.data;

    const [item] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);

    if (!item) {
      throw new Error(`Item ${itemId} not found`);
    }

    // Classify and extract metadata
    const structured = await classifyAndExtract(item.raw);

    // Update item with structured data
    await db
      .update(items)
      .set({
        type: structured.type as any,
        tags: structured.tags,
        clean: structured.summary,
        title: structured.title,
      })
      .where(eq(items.id, itemId));

    // Queue for indexing
    await indexingQueue.add('index', { itemId });

    console.log(`Processed item ${itemId}`);
  },
  { connection: redisConnection }
);
