import express from 'express';
import jwt from 'jsonwebtoken';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { ContactModel } from '../models/Contact.js';
import { UserModel } from '../models/User.js';
import { JWT_SECRET } from '../config/auth.js';
import { contactStreamService } from '../services/contactStream.js';

const router = express.Router();

router.get('/stream', async (req: express.Request, res: express.Response) => {
  try {
    let token: string | null = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.query.token && typeof req.query.token === 'string') {
      token = req.query.token;
    }

    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let decoded: { userId: string; email: string };
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    } catch {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const user = await UserModel.findById(decoded.userId);
    if (!user || !user.verified) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (req.socket && typeof req.socket.setKeepAlive === 'function') {
      req.socket.setKeepAlive(true);
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const client = contactStreamService.addClient(user.id, res);

    const cleanup = () => {
      contactStreamService.removeClient(user.id, client);
    };

    req.on('close', cleanup);
    req.on('end', cleanup);
  } catch (error) {
    console.error('[Contacts SSE] Failed to establish contact stream:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to establish stream' });
    }
  }
});

router.use(authMiddleware);

const sanitizeString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

router.get('/', async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const limitParam = typeof req.query.limit === 'string' ? req.query.limit : undefined;
    const offsetParam = typeof req.query.offset === 'string' ? req.query.offset : undefined;

    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : 50;
    const parsedOffset = offsetParam ? Number.parseInt(offsetParam, 10) : 0;

    const limit = Number.isNaN(parsedLimit) ? 50 : Math.min(Math.max(parsedLimit, 1), 100);
    const offset = Number.isNaN(parsedOffset) ? 0 : Math.max(parsedOffset, 0);

    const results = await ContactModel.listByOwner(req.user.id, { limit: limit + 1, offset });

    const hasMore = results.length > limit;
    const contacts = hasMore ? results.slice(0, limit) : results;

    res.json({
      contacts,
      pagination: {
        limit,
        offset,
        hasMore,
        nextOffset: hasMore ? offset + limit : null,
      },
    });
  } catch (error) {
    console.error('[Contacts] Failed to list contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

router.post('/', async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const name = sanitizeString(req.body?.name);
    const email = sanitizeString(req.body?.email);
    const phone = sanitizeString(req.body?.phone);
    const sourceItemId = sanitizeString(req.body?.source_item_id ?? req.body?.sourceItemId);

    if (!name && !email && !phone) {
      return res
        .status(400)
        .json({ error: 'Provide at least one of name, email, or phone to create a contact.' });
    }

    const metadata =
      req.body?.metadata && typeof req.body.metadata === 'object'
        ? (req.body.metadata as Record<string, unknown>)
        : undefined;

    const contact = await ContactModel.upsert({
      ownerId: req.user.id,
      name,
      email,
      phone,
      sourceItemId: sourceItemId ?? undefined,
      metadata: {
        source: 'manual',
        ...(metadata ?? {}),
      },
    });

    if (!contact) {
      return res.status(400).json({ error: 'Unable to create contact with provided details.' });
    }

    contactStreamService.broadcastContact(contact);

    return res.status(201).json({ contact });
  } catch (error) {
    console.error('[Contacts] Failed to create contact:', error);
    return res.status(500).json({ error: 'Failed to create contact' });
  }
});

router.patch('/:id', async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const contactId = req.params.id;
    if (!contactId) {
      return res.status(400).json({ error: 'Contact ID is required.' });
    }

    const updates = {
      name: req.body?.name !== undefined ? sanitizeString(req.body.name) : undefined,
      email: req.body?.email !== undefined ? sanitizeString(req.body.email) : undefined,
      phone: req.body?.phone !== undefined ? sanitizeString(req.body.phone) : undefined,
      metadata:
        req.body?.metadata !== undefined && typeof req.body.metadata === 'object'
          ? (req.body.metadata as Record<string, unknown> | null)
          : undefined,
    };

    try {
      const contact = await ContactModel.update(req.user.id, contactId, updates);
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }
      contactStreamService.broadcastContact(contact);
      return res.json({ contact });
    } catch (updateError) {
      if (updateError instanceof Error) {
        if (updateError.message.includes('At least one of name')) {
          return res.status(400).json({ error: updateError.message });
        }
      }
      throw updateError;
    }
  } catch (error) {
    console.error('[Contacts] Failed to update contact:', error);
    return res.status(500).json({ error: 'Failed to update contact' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const contactId = req.params.id;
    if (!contactId) {
      return res.status(400).json({ error: 'Contact ID is required.' });
    }

    const deleted = await ContactModel.delete(req.user.id, contactId);
    if (!deleted) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    contactStreamService.broadcastContactDeleted(req.user.id, contactId);

    return res.status(204).send();
  } catch (error) {
    console.error('[Contacts] Failed to delete contact:', error);
    return res.status(500).json({ error: 'Failed to delete contact' });
  }
});

export default router;
