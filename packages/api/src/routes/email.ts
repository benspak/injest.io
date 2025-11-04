import { Router } from 'express';
import { db } from '../db/index.js';
import { items } from '../db/schema.js';
import { authMiddleware, AuthRequest } from '../auth/middleware.js';
import { queue } from '../jobs/queue.js';

const router = Router();

// Inbound email webhook from Resend
router.post('/inbound', async (req, res) => {
  try {
    // Resend webhook format
    const { from, to, subject, text, html } = req.body;

    if (!from || !text) {
      return res.status(400).json({ error: 'Invalid email data' });
    }

    // Extract email from "Name <email@example.com>" format
    const emailMatch = from.match(/<(.+)>/);
    const email = emailMatch ? emailMatch[1] : from;

    // Find user by email
    const { users } = await import('../db/schema.js');
    const { eq } = await import('drizzle-orm');

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create item from email
    const content = html || text;
    const [item] = await db
      .insert(items)
      .values({
        ownerId: user.id,
        type: 'email',
        raw: `Subject: ${subject}\n\n${content}`,
        source: {
          app: 'email',
          from,
          to,
          subject,
        },
      })
      .returning();

    // Queue indexing
    await queue.add('index-item', { itemId: item.id });

    res.json({ message: 'Email captured', item });
  } catch (error) {
    console.error('Email webhook error:', error);
    res.status(500).json({ error: 'Failed to process email' });
  }
});

export default router;
