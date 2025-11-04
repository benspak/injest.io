import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../auth/middleware.js';
import { db } from '../db/index.js';
import { items, embeddings } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { generateContextualResponse, getEmbedding } from '../services/openai.js';

const router = Router();

router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { prompt, contextItemIds } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    let contextItems: string[] = [];

    // If context items provided, fetch them
    if (contextItemIds && Array.isArray(contextItemIds) && contextItemIds.length > 0) {
      const itemsList = await db
        .select({ raw: items.raw, clean: items.clean })
        .from(items)
        .where(and(
          eq(items.ownerId, req.userId!),
          sql`${items.id} = ANY(${contextItemIds})`
        ));

      contextItems = itemsList.map(item => item.clean || item.raw);
    } else {
      // Otherwise, use semantic search to find relevant context
      const queryEmbedding = await getEmbedding(prompt);
      const embeddingArray = queryEmbedding.join(',');

      const results = await db.execute(sql`
        SELECT i.raw, i.clean
        FROM items i
        INNER JOIN embeddings e ON i.embedding_id = e.id
        WHERE i.owner_id = ${req.userId!}
        ORDER BY 1 - (e.embedding <=> ${sql.raw(`'[${embeddingArray}]'`)}::vector) DESC
        LIMIT 5
      `);

      contextItems = (results.rows as any[]).map(r => r.clean || r.raw);
    }

    // Generate response
    const response = await generateContextualResponse(prompt, contextItems);

    res.json({ response, contextCount: contextItems.length });
  } catch (error) {
    console.error('Generate error:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

export default router;
