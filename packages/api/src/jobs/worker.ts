import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { db } from '../db/index.js';
import { items, embeddings } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { getEmbedding, classifyAndStructure } from '../services/openai.js';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const worker = new Worker(
  'indexing-queue',
  async (job) => {
    const { itemId } = job.data;

    try {
      // Get item
      const [item] = await db
        .select()
        .from(items)
        .where(eq(items.id, itemId))
        .limit(1);

      if (!item) {
        throw new Error(`Item ${itemId} not found`);
      }

      // Skip if already indexed
      if (item.embeddingId) {
        return { message: 'Already indexed' };
      }

      // Get embedding
      const textToEmbed = item.clean || item.raw;
      const embedding = await getEmbedding(textToEmbed);

      // Store embedding (Drizzle customType will convert array to vector format)
      const [embeddingRecord] = await db
        .insert(embeddings)
        .values({
          itemId: item.id,
          embedding: embedding, // customType handles conversion
        })
        .returning();

      // Auto-structure (Day 2 feature)
      const structured = await classifyAndStructure(item.raw);

      // Update item with embedding and structured data
      await db
        .update(items)
        .set({
          embeddingId: embeddingRecord.id,
          clean: structured.summary,
          tags: structured.tags,
          type: structured.type,
        })
        .where(eq(items.id, itemId));

      return { message: 'Indexed successfully', itemId };
    } catch (error: any) {
      console.error('Indexing job error:', error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 5,
  }
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

export default worker;
