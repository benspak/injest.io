import { Router, Response } from 'express';
import { db } from '../db/index.js';
import { items, embeddings } from '../db/schema.js';
import { eq, desc, sql } from 'drizzle-orm';
import { authMiddleware, AuthRequest } from '../auth/middleware.js';
import { generateEmbedding } from '../services/openai.js';
import { queue } from '../jobs/queue.js';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);

const itemSchema = z.object({
  type: z.enum(['note', 'link', 'file']),
  raw: z.string().min(1),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// Universal capture endpoint
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const validation = itemSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid item data', details: validation.error });
    }

    const { type, raw, source, tags } = validation.data;

    const [item] = await db
      .insert(items)
      .values({
        ownerId: userId,
        type,
        raw,
        source,
        tags: tags || [],
      })
      .returning();

    // Queue indexing job
    await queue.add('index-item', {
      itemId: item.id,
      content: raw,
    });

    res.status(201).json(item);
  } catch (error: any) {
    console.error('Create item error:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// Trigger indexing manually
router.post('/:id/index', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const [item] = await db
      .select()
      .from(items)
      .where(eq(items.id, id))
      .limit(1);

    if (!item || item.ownerId !== userId) {
      return res.status(404).json({ error: 'Item not found' });
    }

    await queue.add('index-item', {
      itemId: item.id,
      content: item.raw,
    });

    res.json({ message: 'Indexing queued' });
  } catch (error: any) {
    console.error('Index error:', error);
    res.status(500).json({ error: 'Failed to queue indexing' });
  }
});

// Semantic search
router.get('/search', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(q);

    // Vector similarity search
    const results = await db
      .select({
        id: items.id,
        type: items.type,
        raw: items.raw,
        clean: items.clean,
        tags: items.tags,
        source: items.source,
        createdAt: items.createdAt,
        similarity: sql<number>`1 - (${embeddings.vector} <=> ${JSON.stringify(queryEmbedding)}::vector)`,
      })
      .from(items)
      .innerJoin(embeddings, eq(items.embeddingId, embeddings.id))
      .where(eq(items.ownerId, userId))
      .orderBy(sql`similarity DESC`)
      .limit(20);

    res.json(results);
  } catch (error: any) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// List user's items
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const results = await db
      .select()
      .from(items)
      .where(eq(items.ownerId, userId))
      .orderBy(desc(items.createdAt))
      .limit(limit)
      .offset(offset);

    res.json(results);
  } catch (error: any) {
    console.error('List items error:', error);
    res.status(500).json({ error: 'Failed to list items' });
  }
});

// Get single item
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const [item] = await db
      .select()
      .from(items)
      .where(eq(items.id, id))
      .limit(1);

    if (!item || item.ownerId !== userId) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json(item);
  } catch (error: any) {
    console.error('Get item error:', error);
    res.status(500).json({ error: 'Failed to get item' });
  }
});

// Delete item
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const [item] = await db
      .select()
      .from(items)
      .where(eq(items.id, id))
      .limit(1);

    if (!item || item.ownerId !== userId) {
      return res.status(404).json({ error: 'Item not found' });
    }

    await db.delete(items).where(eq(items.id, id));

    res.json({ message: 'Item deleted' });
  } catch (error: any) {
    console.error('Delete item error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

export default router;
