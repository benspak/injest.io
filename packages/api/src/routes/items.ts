import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { items, embeddings } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { authMiddleware, AuthRequest } from '../auth/middleware.js';
import { getEmbedding } from '../services/openai.js';
import { queue } from '../jobs/queue.js';

const router = Router();

const createItemSchema = z.object({
  type: z.enum(['note', 'link', 'file', 'email']),
  raw: z.string().min(1),
  source: z.object({
    app: z.string().optional(),
    url: z.string().optional(),
  }).optional(),
});

// Create item
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const body = createItemSchema.parse(req.body);

    const [item] = await db
      .insert(items)
      .values({
        ownerId: req.userId!,
        type: body.type,
        raw: body.raw,
        source: body.source || null,
      })
      .returning();

    // Queue indexing job
    await queue.add('index-item', { itemId: item.id });

    res.json({ item });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create item error:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// List items
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const isTask = req.query.isTask === 'true';

    const conditions: any[] = [eq(items.ownerId, req.userId!)];
    if (isTask) {
      conditions.push(eq(items.isTask, true));
    }

    const itemsList = await db
      .select()
      .from(items)
      .where(and(...conditions))
      .orderBy(sql`${items.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    res.json({ items: itemsList });
  } catch (error) {
    console.error('List items error:', error);
    res.status(500).json({ error: 'Failed to list items' });
  }
});

// Get single item
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const [item] = await db
      .select()
      .from(items)
      .where(and(eq(items.id, req.params.id), eq(items.ownerId, req.userId!)))
      .limit(1);

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ item });
  } catch (error) {
    console.error('Get item error:', error);
    res.status(500).json({ error: 'Failed to get item' });
  }
});

// Semantic search
router.post('/search', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Get embedding for search query
    const queryEmbedding = await getEmbedding(query);

    // Search using pgvector cosine similarity
    const embeddingArray = queryEmbedding.join(',');
    const searchResults = await db.execute(sql`
      SELECT
        i.id,
        i.type,
        i.raw,
        i.clean,
        i.tags,
        i.source,
        i.created_at,
        1 - (e.embedding <=> ${sql.raw(`'[${embeddingArray}]'`)}::vector) as similarity
      FROM items i
      INNER JOIN embeddings e ON i.embedding_id = e.id
      WHERE i.owner_id = ${req.userId!}
      ORDER BY similarity DESC
      LIMIT 10
    `);

    const results = (searchResults.rows as any[]).map(row => ({
      id: row.id,
      type: row.type,
      raw: row.raw,
      clean: row.clean,
      tags: row.tags,
      source: row.source,
      createdAt: row.created_at,
      similarity: parseFloat(row.similarity),
    }));

    res.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Trigger indexing
router.post('/:id/index', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const [item] = await db
      .select()
      .from(items)
      .where(and(eq(items.id, req.params.id), eq(items.ownerId, req.userId!)))
      .limit(1);

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    await queue.add('index-item', { itemId: item.id });

    res.json({ message: 'Indexing queued' });
  } catch (error) {
    console.error('Index error:', error);
    res.status(500).json({ error: 'Failed to queue indexing' });
  }
});

// Taskify (convert to task)
router.post('/:id/taskify', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const [item] = await db
      .update(items)
      .set({ isTask: true })
      .where(and(eq(items.id, req.params.id), eq(items.ownerId, req.userId!)))
      .returning();

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ item });
  } catch (error) {
    console.error('Taskify error:', error);
    res.status(500).json({ error: 'Failed to convert to task' });
  }
});

export default router;
