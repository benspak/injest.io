import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { ItemModel } from '../models/Item.js';
import { TaskModel } from '../models/Task.js';
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
        // Prioritize structured fields (title/description) over raw data
        let title = item.title || '';
        let description = item.description || '';
        // If structured fields are missing, try to parse or use raw data
        if (!title && !description && item.raw) {
            try {
                const parsed = JSON.parse(item.raw);
                title = parsed.title || parsed.subject || title;
                description = parsed.description || parsed.body || parsed.text || description;
            }
            catch {
                // If parsing fails, use raw as fallback
                title = item.raw.substring(0, 100);
                description = item.raw;
            }
        }
        // Final fallback: ensure we have at least something
        if (!title && !description) {
            title = 'Untitled Task';
            description = '';
        }
        // Create task
        const task = await TaskModel.create({
            item_id: item.id,
            title,
            description,
            status: 'pending',
        });
        // Update item type to task
        await ItemModel.update(item.id, { type: 'task' });
        res.status(201).json(task);
    }
    catch (error) {
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
        const status = typeof req.query.status === 'string' ? req.query.status : undefined;
        const tasks = await TaskModel.findByOwner(req.user.id, status);
        // Fetch items for each task
        const tasksWithItems = await Promise.all(tasks.map(async (task) => {
            const item = await ItemModel.findById(task.item_id);
            return {
                ...task,
                item: item || undefined,
            };
        }));
        res.json(tasksWithItems);
    }
    catch (error) {
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
        const { title, description, status, due_date } = req.body;
        // Verify task ownership
        const task = await TaskModel.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        const item = await ItemModel.findById(task.item_id);
        if (!item || item.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const updates = {
            title,
            description,
            status,
        };
        // Handle due_date: if provided, convert to Date; if explicitly null, set to null
        if (due_date !== undefined) {
            updates.due_date = due_date ? new Date(due_date) : null;
        }
        const updatedTask = await TaskModel.update(req.params.id, updates);
        res.json(updatedTask);
    }
    catch (error) {
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
        // Verify task ownership
        const task = await TaskModel.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        const item = await ItemModel.findById(task.item_id);
        if (!item || item.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const deleted = await TaskModel.delete(req.params.id);
        if (!deleted) {
            return res.status(500).json({ error: 'Failed to delete task' });
        }
        res.status(204).send();
    }
    catch (error) {
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
        const { prompt } = req.body;
        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
            return res.status(400).json({ error: 'Prompt is required' });
        }
        // Get task and verify ownership
        const task = await TaskModel.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        const item = await ItemModel.findById(task.item_id);
        if (!item || item.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        // Try to parse file content if item has attachments
        let fileContent;
        if (item.attachments && Array.isArray(item.attachments) && item.attachments.length > 0) {
            try {
                const firstAttachment = item.attachments[0];
                if (firstAttachment.filename) {
                    const parsed = await fileParserService.parseFile(firstAttachment.filename, firstAttachment.mimetype);
                    fileContent = parsed.text;
                }
            }
            catch (error) {
                console.warn('Could not parse file content:', error);
                // Continue without file content
            }
        }
        // Process prompt with OpenAI
        const updates = await openAIService.processTaskPrompt(prompt.trim(), item, task, fileContent);
        // Apply updates to item if any
        if (Object.keys(updates.itemUpdates).length > 0) {
            await ItemModel.update(item.id, updates.itemUpdates);
        }
        // Apply updates to task if any
        if (Object.keys(updates.taskUpdates).length > 0) {
            await TaskModel.update(task.id, updates.taskUpdates);
        }
        // Fetch updated task and item
        const updatedTask = await TaskModel.findById(task.id);
        const updatedItem = await ItemModel.findById(item.id);
        res.json({
            task: updatedTask,
            item: updatedItem,
            message: 'Task and item updated successfully',
        });
    }
    catch (error) {
        console.error('Error processing task prompt:', error);
        res.status(500).json({
            error: 'Failed to process prompt',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
export default router;
//# sourceMappingURL=tasks.js.map