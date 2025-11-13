import express from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { ContactModel } from '../models/Contact.js';
import { UserModel } from '../models/User.js';
import { JWT_SECRET } from '../config/auth.js';
import { contactStreamService } from '../services/contactStream.js';
import { parseVCard } from '../utils/vcard.js';
import { indexingService } from '../services/indexing.js';

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

const contactsUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

router.post(
  '/import',
  contactsUpload.single('contactsFile'),
  async (req: AuthRequest, res: express.Response) => {
    const importId = randomUUID();
    let broadcastStarted = false;
    let parsedEntryCount = 0;
    let skippedMissingDetails = 0;
    let skippedDuplicates = 0;
    let originalName = 'contacts.vcf';

    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const file = req.file;
      if (!file || !file.buffer) {
        return res.status(400).json({ error: 'No contacts file provided.' });
      }

      originalName = file.originalname || 'contacts.vcf';
      const lowerName = originalName.toLowerCase();
      const allowedExtensions = ['.vcf', '.vcard'];
      const allowedMimeTypes = ['text/vcard', 'text/x-vcard', 'application/vcard', 'application/x-vcard'];
      const hasAllowedExtension = allowedExtensions.some((ext) => lowerName.endsWith(ext));
      const hasAllowedMimeType = allowedMimeTypes.includes(file.mimetype);

      if (!hasAllowedExtension && !hasAllowedMimeType) {
        return res.status(400).json({ error: 'Unsupported file type. Please upload a .vcf (vCard) file.' });
      }

      const content = file.buffer.toString('utf8');
      const parsedEntries = parseVCard(content);

      parsedEntryCount = parsedEntries.length;

      if (parsedEntries.length === 0) {
        return res.status(400).json({ error: 'No contacts found in the uploaded file.' });
      }

      contactStreamService.broadcastImportStatus(req.user.id, {
        status: 'started',
        importId,
        fileName: originalName,
        total: parsedEntryCount,
      });
      broadcastStarted = true;

      const dedupeKeys = new Set<string>();
      const inputs: {
        ownerId: string;
        name?: string | null;
        email?: string | null;
        phone?: string | null;
        metadata?: Record<string, unknown> | null;
      }[] = [];

      skippedMissingDetails = 0;
      skippedDuplicates = 0;

      for (const entry of parsedEntries) {
        const name = sanitizeString(entry.name);
        const email = entry.emails.map((value) => sanitizeString(value)).find((value) => value) ?? null;
        const phone =
          entry.phones
            .map((value) => sanitizeString(value))
            .find((value) => value && value.replace(/\D+/g, '').length >= 6) ?? null;

        if (!name && !email && !phone) {
          skippedMissingDetails += 1;
          continue;
        }

        const normalizedEmail = (email ?? '').toLowerCase();
        const normalizedPhone = phone ? phone.replace(/\D+/g, '') : '';
        const dedupeKey = `${normalizedEmail}::${normalizedPhone}`;

        if (dedupeKeys.has(dedupeKey)) {
          skippedDuplicates += 1;
          continue;
        }
        dedupeKeys.add(dedupeKey);

        inputs.push({
          ownerId: req.user.id,
          name,
          email,
          phone,
          metadata: {
            source: 'vcf-import',
            importFilename: originalName,
            importTimestamp: new Date().toISOString(),
            emails: entry.emails,
            phones: entry.phones,
          },
        });
      }

      if (inputs.length === 0) {
        contactStreamService.broadcastImportStatus(req.user.id, {
          status: 'failed',
          importId,
          fileName: originalName,
          total: parsedEntryCount,
          imported: 0,
          skipped: {
            duplicates: skippedDuplicates,
            missingDetails: skippedMissingDetails,
          },
          error: 'No contacts with email or phone were found to import.',
        });

        return res.status(400).json({
          error: 'No contacts with email or phone were found to import.',
          skipped: {
            duplicates: skippedDuplicates,
            missingDetails: skippedMissingDetails,
          },
        });
      }

      const contacts = await ContactModel.upsertMany(inputs);

      if (contacts.length > 0) {
        contactStreamService.broadcastContacts(contacts);
        await Promise.all(
          contacts.map(async (contact) => {
            try {
              await indexingService.indexContact(contact);
            } catch (error) {
              console.warn('[Contacts] Failed to index contact during import:', {
                contactId: contact.id,
                error,
              });
            }
          })
        );
      }

      contactStreamService.broadcastImportStatus(req.user.id, {
        status: 'completed',
        importId,
        fileName: originalName,
        total: parsedEntryCount,
        imported: contacts.length,
        skipped: {
          duplicates: skippedDuplicates,
          missingDetails: skippedMissingDetails,
        },
      });

      return res.status(201).json({
        message: `Processed ${parsedEntries.length} contact${parsedEntries.length === 1 ? '' : 's'}.`,
        processed: parsedEntries.length,
        imported: contacts.length,
        skipped: {
          duplicates: skippedDuplicates,
          missingDetails: skippedMissingDetails,
        },
      });
    } catch (error) {
      console.error('[Contacts] Failed to import contacts:', error);
      if (req.user && broadcastStarted) {
        contactStreamService.broadcastImportStatus(req.user.id, {
          status: 'failed',
          importId,
          fileName: originalName,
          total: parsedEntryCount,
          imported: 0,
          skipped: {
            duplicates: skippedDuplicates,
            missingDetails: skippedMissingDetails,
          },
          error: error instanceof Error ? error.message : 'Failed to import contacts.',
        });
      }
      return res.status(500).json({ error: 'Failed to import contacts' });
    }
  }
);

router.get('/count', async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const searchParam = typeof req.query.search === 'string' ? req.query.search : undefined;
    const search = searchParam ? searchParam.trim() : undefined;

    const count = await ContactModel.countByOwner(req.user.id, { search });

    return res.json({ count });
  } catch (error) {
    console.error('[Contacts] Failed to count contacts:', error);
    return res.status(500).json({ error: 'Failed to fetch contact count' });
  }
});

router.get('/', async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const limitParam = typeof req.query.limit === 'string' ? req.query.limit : undefined;
    const offsetParam = typeof req.query.offset === 'string' ? req.query.offset : undefined;
    const searchParam = typeof req.query.search === 'string' ? req.query.search : undefined;

    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : 50;
    const parsedOffset = offsetParam ? Number.parseInt(offsetParam, 10) : 0;

    const limit = Number.isNaN(parsedLimit) ? 50 : Math.min(Math.max(parsedLimit, 1), 100);
    const offset = Number.isNaN(parsedOffset) ? 0 : Math.max(parsedOffset, 0);
    const search = searchParam ? searchParam.trim() : undefined;

    const results = await ContactModel.listByOwner(req.user.id, {
      limit: limit + 1,
      offset,
      search,
    });

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
    const linkedinUrl = sanitizeString(req.body?.linkedin_url ?? req.body?.linkedinUrl);
    const xUrl = sanitizeString(req.body?.x_url ?? req.body?.xUrl);
    const githubUrl = sanitizeString(req.body?.github_url ?? req.body?.githubUrl);
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
      linkedinUrl,
      xUrl,
      githubUrl,
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
    try {
      await indexingService.indexContact(contact);
    } catch (error) {
      console.warn('[Contacts] Failed to index contact on creation:', {
        contactId: contact.id,
        error,
      });
    }

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
      linkedinUrl:
        req.body?.linkedin_url !== undefined || req.body?.linkedinUrl !== undefined
          ? sanitizeString(req.body.linkedin_url ?? req.body.linkedinUrl)
          : undefined,
      xUrl:
        req.body?.x_url !== undefined || req.body?.xUrl !== undefined
          ? sanitizeString(req.body.x_url ?? req.body.xUrl)
          : undefined,
      githubUrl:
        req.body?.github_url !== undefined || req.body?.githubUrl !== undefined
          ? sanitizeString(req.body.github_url ?? req.body.githubUrl)
          : undefined,
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
      try {
        await indexingService.indexContact(contact);
      } catch (error) {
        console.warn('[Contacts] Failed to index contact on update:', {
          contactId: contact.id,
          error,
        });
      }
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
    await indexingService.removeSearchDocument('contact', contactId);

    return res.status(204).send();
  } catch (error) {
    console.error('[Contacts] Failed to delete contact:', error);
    return res.status(500).json({ error: 'Failed to delete contact' });
  }
});

export default router;
