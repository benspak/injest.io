import { Router, Response } from 'express';
import { db } from '../db/index.js';
import { tasks, items } from '../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { authMiddleware, AuthRequest } from '../auth/middleware.js';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);

const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  dueDate: z.string().optional(),
});

// Convert item to task
router.post('/items/:id/taskify', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id: itemId } = req.params;

    // Get item
    const [item] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);

    if (!item || item.ownerId !== userId) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Create task from item
    const title = item.clean || item.raw.substring(0, 100);
    const [task] = await db
      .insert(tasks)
      .values({
        itemId,
        ownerId: userId,
        title,
        description: item.raw.length > 100 ? item.raw : null,
        status: 'todo',
        priority: 'medium',
      })
      .returning();

    res.status(201).json(task);
  } catch (error: any) {
    console.error('Taskify error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// List user's tasks
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const status = req.query.status as string | undefined;
    const priority = req.query.priority as string | undefined;

    let conditions: any[] = [eq(tasks.ownerId, userId)];

    if (status) {
      conditions.push(eq(tasks.status, status as any));
    }

    const results = await db
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(desc(tasks.createdAt));

    res.json(results);
  } catch (error: any) {
    console.error('List tasks error:', error);
    res.status(500).json({ error: 'Failed to list tasks' });
  }
});

// Update task
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const updates = taskSchema.partial().parse(req.body);

    const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);

    if (!task || task.ownerId !== userId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updateData: any = {};
    if (updates.title) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.priority) updateData.priority = updates.priority;
    if (updates.dueDate) updateData.dueDate = new Date(updates.dueDate);
    if (req.body.status) updateData.status = req.body.status;

    const [updated] = await db.update(tasks).set(updateData).where(eq(tasks.id, id)).returning();

    res.json(updated);
  } catch (error: any) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete task
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);

    if (!task || task.ownerId !== userId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await db.delete(tasks).where(eq(tasks.id, id));

    res.json({ message: 'Task deleted' });
  } catch (error: any) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;
