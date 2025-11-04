import { Router, Response } from 'express';
import { db } from '../db/index.js';
import { items } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { authMiddleware, AuthRequest } from '../auth/middleware.js';
import {
  generateEmailDraft,
  generateSummary,
  generateReply,
} from '../services/openai.js';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);

const generateSchema = z.object({
  type: z.enum(['email_draft', 'summary', 'reply']),
  itemIds: z.array(z.string()).min(1),
  prompt: z.string().optional(),
  originalMessage: z.string().optional(), // For reply type
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const validation = generateSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request', details: validation.error });
    }

    const { type, itemIds, prompt, originalMessage } = validation.data;

    // Fetch items and verify ownership
    const userItems = await db
      .select()
      .from(items)
      .where(eq(items.ownerId, userId));

    const requestedItems = userItems.filter((item) => itemIds.includes(item.id));

    if (requestedItems.length === 0) {
      return res.status(404).json({ error: 'No items found' });
    }

    let result: string;

    switch (type) {
      case 'email_draft':
        if (!prompt) {
          return res.status(400).json({ error: 'Prompt required for email draft' });
        }
        result = await generateEmailDraft(requestedItems, prompt);
        break;

      case 'summary':
        result = await generateSummary(requestedItems);
        break;

      case 'reply':
        if (!originalMessage) {
          return res.status(400).json({ error: 'Original message required for reply' });
        }
        result = await generateReply(requestedItems, originalMessage);
        break;

      default:
        return res.status(400).json({ error: 'Invalid generation type' });
    }

    res.json({ result, type, itemIds: requestedItems.map((i) => i.id) });
  } catch (error: any) {
    console.error('Generation error:', error);
    res.status(500).json({ error: 'Generation failed' });
  }
});

export default router;
