import { Router, Response } from 'express';
import { db } from '../db/index.js';
import { items, users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { queue } from '../jobs/queue.js';

const router = Router();

// Resend webhook handler
router.post('/inbound', async (req: any, res: Response) => {
  try {
    // Extract email from Resend webhook format
    const { from, to, subject, text, html, attachments } = req.body;

    if (!from || !to || !text) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Extract user ID from email address (e.g., user123@brain.yourdomain.com)
    const emailMatch = to.match(/^([^@]+)@/);
    if (!emailMatch) {
      return res.status(400).json({ error: 'Invalid email address format' });
    }

    // Try to find user by email prefix or parse from forwarding address
    // For MVP, we'll try to match the "to" email or extract user ID
    // In production, maintain a mapping of forwarding addresses to user IDs
    const [user] = await db.select().from(users).where(eq(users.email, from.email)).limit(1);

    if (!user) {
      // Could also create a new user or handle differently
      return res.status(404).json({ error: 'User not found' });
    }

    // Create item from email
    const emailContent = html || text;
    const raw = `Subject: ${subject}\n\nFrom: ${from.email}\n\n${emailContent}`;

    const [item] = await db
      .insert(items)
      .values({
        ownerId: user.id,
        type: 'note',
        raw,
        clean: text, // Plain text version
        source: `email:${from.email}`,
        tags: ['email'],
      })
      .returning();

    // Queue indexing
    await queue.add('index-item', {
      itemId: item.id,
      content: raw,
    });

    res.json({ success: true, itemId: item.id });
  } catch (error: any) {
    console.error('Email webhook error:', error);
    res.status(500).json({ error: 'Failed to process email' });
  }
});

export default router;
