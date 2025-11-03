import { Router } from 'express';
import { db } from '../db/index.js';
import { items } from '../db/schema.js';
import { AuthRequest, authMiddleware } from '../auth/middleware.js';
import { processingQueue } from '../jobs/queue.js';

export const emailRouter = Router();
emailRouter.use(authMiddleware);

// Email ingestion endpoint
// This would be called by an email service (SendGrid, Mailgun, etc.) webhook
emailRouter.post('/email/ingest', async (req: AuthRequest, res) => {
  try {
    const { from, subject, text, html, to } = req.body;

    // Extract email address from "to" field (format: user+token@domain.com)
    // The token can be used for authentication
    const rawContent = html || text || '';
    const cleanText = rawContent.replace(/<[^>]*>/g, '').trim();

    if (!cleanText) {
      return res.status(400).json({ error: 'No content in email' });
    }

    const [item] = await db
      .insert(items)
      .values({
        ownerId: req.userId!,
        type: 'email',
        raw: cleanText,
        title: subject || 'No subject',
        source: {
          app: 'email',
          metadata: {
            from,
            subject,
            to,
          },
        },
      })
      .returning();

    // Queue for processing
    await processingQueue.add('process', { itemId: item.id });

    res.json({ success: true, itemId: item.id });
  } catch (error) {
    console.error('Email ingest error:', error);
    res.status(500).json({ error: 'Failed to ingest email' });
  }
});
