import { Router } from 'express';
import { db } from '../db/index.js';
import { items } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { authMiddleware, AuthRequest } from '../auth/middleware.js';

const router = Router();

// List tasks
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const tasksList = await db
      .select()
      .from(items)
      .where(and(
        eq(items.ownerId, req.userId!),
        eq(items.isTask, true)
      ))
      .orderBy(sql`${items.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    res.json({ tasks: tasksList });
  } catch (error) {
    console.error('List tasks error:', error);
    res.status(500).json({ error: 'Failed to list tasks' });
  }
});

export default router;
