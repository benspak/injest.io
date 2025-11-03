import { Router } from 'express';
import { db } from '../db/index.js';
import { items, interactions } from '../db/schema.js';
import { eq, desc, sql } from 'drizzle-orm';
import { AuthRequest, authMiddleware } from '../auth/middleware.js';
import { processingQueue } from '../jobs/queue.js';
import { generateCompletion } from '../services/openai.js';

export const itemsRouter = Router();
itemsRouter.use(authMiddleware);

// Capture - create new item
itemsRouter.post('/items', async (req: AuthRequest, res) => {
  try {
    const { raw, type, source } = req.body;

    if (!raw) {
      return res.status(400).json({ error: 'Content required' });
    }

    const [item] = await db
      .insert(items)
      .values({
        ownerId: req.userId!,
        type: type || 'note',
        raw,
        source: source || {},
      })
      .returning();

    // Queue for processing (auto-structuring + indexing)
    await processingQueue.add('process', { itemId: item.id });

    res.json(item);
  } catch (error) {
    console.error('Create item error:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// List items
itemsRouter.get('/items', async (req: AuthRequest, res) => {
  try {
    const { limit = 50, offset = 0, type, isTask } = req.query;

    const conditions = [eq(items.ownerId, req.userId!)];

    if (type) {
      conditions.push(eq(items.type, type as any));
    }

    if (isTask === 'true') {
      conditions.push(eq(items.isTask, true));
    }

    const itemsList = await db
      .select()
      .from(items)
      .where(sql`${items.ownerId} = ${req.userId}`)
      .orderBy(desc(items.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    res.json(itemsList);
  } catch (error) {
    console.error('List items error:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// Semantic search
itemsRouter.post('/items/search', async (req: AuthRequest, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query required' });
    }

    // Generate embedding for query
    const { generateEmbedding } = await import('../services/openai.js');
    const queryEmbedding = await generateEmbedding(query);
    const embeddingArray = `[${queryEmbedding.join(',')}]`;

    // Vector similarity search using pgvector
    const results = await db.execute(sql`
      SELECT
        id, owner_id, type, raw, clean, title, tags, source,
        metadata, is_task, task_completed, created_at,
        1 - (embedding <=> ${embeddingArray}::vector) as similarity
      FROM items
      WHERE owner_id = ${req.userId}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${embeddingArray}::vector
      LIMIT 10
    `);

    // Log interaction
    await db.insert(interactions).values({
      userId: req.userId!,
      type: 'query',
      query,
      metadata: { resultCount: results.length },
    });

    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Taskify - convert item to task
itemsRouter.post('/items/:id/taskify', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const [item] = await db
      .update(items)
      .set({ isTask: true, taskCompleted: false })
      .where(eq(items.id, id))
      .returning();

    // Log interaction
    await db.insert(interactions).values({
      userId: req.userId!,
      itemId: id,
      type: 'taskify',
    });

    res.json(item);
  } catch (error) {
    console.error('Taskify error:', error);
    res.status(500).json({ error: 'Failed to taskify item' });
  }
});

// Toggle task completion
itemsRouter.patch('/items/:id/task', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { completed } = req.body;

    const [item] = await db
      .update(items)
      .set({ taskCompleted: completed ?? false })
      .where(eq(items.id, id))
      .returning();

    res.json(item);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Generate - contextual AI responses
itemsRouter.post('/items/generate', async (req: AuthRequest, res) => {
  try {
    const { prompt, contextItemIds } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt required' });
    }

    // Fetch context items
    let context = '';
    if (contextItemIds && contextItemIds.length > 0) {
      const contextItems = await db
        .select()
        .from(items)
        .where(sql`${items.id} = ANY(${contextItemIds}) AND ${items.ownerId} = ${req.userId}`);

      context = contextItems.map(item =>
        `${item.title || 'Item'}: ${item.clean || item.raw}`
      ).join('\n\n');
    }

    const response = await generateCompletion(prompt, context);

    // Log interaction
    await db.insert(interactions).values({
      userId: req.userId!,
      type: 'generate',
      query: prompt,
      response,
      metadata: { contextItemIds },
    });

    res.json({ response });
  } catch (error) {
    console.error('Generate error:', error);
    res.status(500).json({ error: 'Generation failed' });
  }
});

// Delete item
itemsRouter.delete('/items/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    await db.delete(items).where(eq(items.id, id));

    res.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});
