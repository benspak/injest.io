import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { ItemModel } from '../models/Item.js';
import { TaskModel, TaskStatus } from '../models/Task.js';
import { openAIService } from '../services/openai.js';
import { fileParserService } from '../services/fileParser.js';

const router = express.Router();

router.use(authMiddleware);

// Convert item to task
router.post('/taskify/:itemId', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const item = await ItemModel.findById(req.params.itemId);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (item.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Check if task already exists
    const existingTask = await TaskModel.findByItemId(item.id);
    if (existingTask) {
      return res.status(400).json({ error: 'Task already exists for this item' });
    }

    // Parse item content for task title/description
    let title = item.title || '';
    let description = item.description || '';

    if (!title && !description && item.raw) {
      try {
        const parsed = JSON.parse(item.raw);
        title = parsed.title || parsed.subject || title;
        description = parsed.description || parsed.body || parsed.text || description;
      } catch {
        title = item.raw.substring(0, 100);
        description = item.raw;
      }
    }

    if (!title && !description) {
      title = 'Untitled Task';
      description = '';
    }

    let dueDate: Date | null = null;
    if (req.body?.due_date) {
      const parsedDue = new Date(req.body.due_date);
      if (!Number.isNaN(parsedDue.getTime())) {
        dueDate = parsedDue;
      }
    }

    const task = await TaskModel.create({
      item_id: item.id,
      title,
      description,
      status: 'pending',
      due_date: dueDate,
    });

    // Update item type to task
    await ItemModel.update(item.id, { type: 'task' });

    const refreshedItem = await ItemModel.findById(item.id);

    res.status(201).json({ task, item: refreshedItem });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// List tasks
router.get('/', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const status = typeof req.query.status === 'string' ? req.query.status as TaskStatus : undefined;
    const tasks = await TaskModel.findByOwner(req.user.id, status);

    const tasksWithItems = await Promise.all(
      tasks.map(async (task) => {
        const item = await ItemModel.findById(task.item_id);
        return {
          ...task,
          item: item || undefined,
        };
      })
    );

    res.json(tasksWithItems);
  } catch (error) {
    console.error('Error listing tasks:', error);
    res.status(500).json({ error: 'Failed to list tasks' });
  }
});

// Update task
router.patch('/:id', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { title, description, status, due_date } = req.body as {
      title?: string;
      description?: string;
      status?: TaskStatus;
      due_date?: string | null;
    };

    const task = await TaskModel.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const item = await ItemModel.findByIdIncludingDeleted(task.item_id);
    if (!item || item.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;
    if (due_date !== undefined) {
      updates.due_date = due_date ? new Date(due_date) : null;
    }

    const updatedTask = await TaskModel.update(req.params.id, updates);
    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete task
router.delete('/:id', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const task = await TaskModel.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const item = await ItemModel.findByIdIncludingDeleted(task.item_id);
    if (!item || item.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const deleted = await TaskModel.delete(req.params.id);
    if (!deleted) {
      return res.status(500).json({ error: 'Failed to delete task' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Process ChatGPT prompt on task
router.post('/:id/prompt', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { prompt } = req.body as { prompt?: string };
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const task = await TaskModel.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const item = await ItemModel.findByIdIncludingDeleted(task.item_id);
    if (!item || item.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    let fileContent: string | undefined;
    if (item.attachments && Array.isArray(item.attachments) && item.attachments.length > 0) {
      try {
        const firstAttachment = item.attachments[0];
        if (firstAttachment.filename) {
          const parsed = await fileParserService.parseFile(firstAttachment.filename, firstAttachment.mimetype);
          fileContent = parsed.text;
        }
      } catch (parseError) {
        console.warn('Could not parse file content:', parseError);
      }
    }

    const updates = await openAIService.processTaskPrompt(
      prompt.trim(),
      item,
      task,
      fileContent
    );

    if (Object.keys(updates.itemUpdates).length > 0) {
      await ItemModel.update(item.id, updates.itemUpdates);
    }

    if (Object.keys(updates.taskUpdates).length > 0) {
      await TaskModel.update(task.id, updates.taskUpdates);
    }

    const updatedTask = await TaskModel.findById(task.id);
    const updatedItem = await ItemModel.findById(item.id);

    res.json({
      task: updatedTask,
      item: updatedItem,
      message: 'Task and item updated successfully',
    });
  } catch (error) {
    console.error('Error processing task prompt:', error);
    res.status(500).json({
      error: 'Failed to process prompt',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
