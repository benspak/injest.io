import express from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { openAIService, type SendPlanContactContext, type SendPlanItemContext } from '../services/openai.js';
import { ContactModel, type Contact } from '../models/Contact.js';
import { searchService } from '../services/search.js';
import { emailService } from '../services/email.js';
import { ItemModel } from '../models/Item.js';
import { ItemAccessModel } from '../models/ItemAccess.js';
import { indexingService } from '../services/indexing.js';

const router = express.Router();

router.use(authMiddleware);

function extractCompanyFromEmail(email?: string | null): string | null {
  if (!email) {
    return null;
  }

  const trimmed = email.trim().toLowerCase();
  const domain = trimmed.split('@')[1];
  if (!domain) {
    return null;
  }

  const withoutSubdomain = domain.replace(/^www\./, '');
  const companyPart = withoutSubdomain.split('.')[0];
  return companyPart ? companyPart : withoutSubdomain;
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function sanitizeContact(contact: Contact) {
  return {
    id: contact.id,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    company: extractCompanyFromEmail(contact.email),
    sourceItemId: contact.source_item_id,
    metadata: contact.metadata,
    createdAt: toIsoString(contact.created_at),
    updatedAt: toIsoString(contact.updated_at),
  };
}

function sanitizeItem(result: Awaited<ReturnType<typeof searchService.search>>[number]) {
  const { item, similarity, scores } = result;
  const attachments = Array.isArray(item.attachments) ? item.attachments : [];

  const safeDescription =
    typeof item.description === 'string'
      ? item.description.slice(0, 600)
      : typeof item.clean === 'string'
      ? item.clean.slice(0, 600)
      : null;

  return {
    id: item.id,
    type: item.type,
    title: item.title,
    description: safeDescription,
    url: item.url,
    tags: item.tags,
    source: item.source,
    similarity,
    scores,
    attachments: attachments?.slice(0, 5) ?? [],
    createdAt: item.created_at ? toIsoString(item.created_at as any) : null,
    updatedAt: item.updated_at ? toIsoString(item.updated_at as any) : null,
  };
}

function buildContactContext(contacts: Contact[]): SendPlanContactContext[] {
  return contacts.map((contact) => ({
    id: contact.id,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    company: extractCompanyFromEmail(contact.email),
    lastInteraction:
      contact.metadata && typeof contact.metadata === 'object' && contact.metadata !== null
        ? (contact.metadata.lastInteraction as string | undefined) ?? undefined
        : undefined,
  }));
}

function buildItemContext(
  results: Awaited<ReturnType<typeof searchService.search>>
): SendPlanItemContext[] {
  return results.map((result) => {
    const { item } = result;
    return {
      id: item.id,
      type: item.type,
      title: item.title,
      description: typeof item.description === 'string'
        ? item.description.slice(0, 500)
        : typeof item.clean === 'string'
        ? item.clean.slice(0, 500)
        : null,
      tags: item.tags ?? null,
      url: item.url ?? null,
      attachments: Array.isArray(item.attachments)
        ? item.attachments
            .slice(0, 3)
            .map((attachment: { filename: string; mimetype?: string; size?: number }) => ({
              filename: attachment.filename,
              mimetype: attachment.mimetype,
              size: attachment.size,
            }))
        : null,
    };
  });
}

function uniqueContacts(contacts: Contact[]): Contact[] {
  const seen = new Set<string>();
  const results: Contact[] = [];
  for (const contact of contacts) {
    if (seen.has(contact.id)) {
      continue;
    }
    seen.add(contact.id);
    results.push(contact);
  }
  return results;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

interface ExecuteAttachmentInput {
  itemId: string;
  attachmentFilename?: string | null;
}

interface ResolvedAttachment {
  storedFilename: string;
  displayName: string;
  mimetype?: string;
  itemId: string;
  itemTitle?: string | null;
}

router.post('/plan', async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const rawPrompt = typeof req.body?.prompt === 'string' ? req.body.prompt : '';
    const prompt = rawPrompt.trim();

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const analysis = await openAIService.analyzeSendPrompt(prompt);

    const keywords = new Set<string>();
    if (analysis.targetCompany) {
      keywords.add(analysis.targetCompany);
    }
    if (analysis.targetPersona) {
      const personaParts = analysis.targetPersona.split(/[,&/]/).map((part) => part.trim());
      for (const part of personaParts) {
        if (part) {
          keywords.add(part);
        }
      }
    }
    analysis.keyFacts.forEach((fact) => {
      const tokens = fact.split(/\s+/).filter((token: string) => token.length > 3);
      tokens.slice(0, 2).forEach((token: string) => keywords.add(token));
    });

    const primaryContacts = await ContactModel.searchForSend(req.user.id, {
      domain: analysis.targetDomain,
      keywords: Array.from(keywords),
      limit: 8,
    });

    let contacts = primaryContacts;
    if (contacts.length < 3) {
      const fallbackKeywords = prompt
        .split(/\s+/)
        .map((word: string) => word.replace(/[^a-zA-Z0-9@.]/g, '').toLowerCase())
        .filter((word: string) => word.length > 3)
        .slice(0, 6);

      if (fallbackKeywords.length > 0) {
        const fallbackContacts = await ContactModel.searchForSend(req.user.id, {
          keywords: fallbackKeywords,
          limit: 8,
          excludeIds: contacts.map((contact) => contact.id),
        });
        contacts = uniqueContacts([...contacts, ...fallbackContacts]);
      }
    }

    const searchQuery =
      analysis.searchQuery && analysis.searchQuery.trim().length > 0
        ? analysis.searchQuery
        : prompt;

    const searchResults = await searchService.search(
      { id: req.user.id, email: req.user.email },
      searchQuery,
      10
    );

    const items = searchResults.slice(0, 8);

    const contactContext = buildContactContext(contacts);
    const itemContext = buildItemContext(items);

    const plan = await openAIService.generateSendPlan({
      prompt,
      analysis,
      contacts: contactContext,
      items: itemContext,
    });

    res.json({
      analysis,
      prompt,
      searchQuery,
      contacts: contacts.map(sanitizeContact),
      items: items.map((item) => sanitizeItem(item)),
      recommendation: plan,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Send] Failed to generate send plan', error);
    res.status(500).json({ error: 'Failed to generate send plan' });
  }
});

router.post('/execute', async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
    const body = typeof req.body?.body === 'string' ? req.body.body : '';
    const contactId = typeof req.body?.contactId === 'string' ? req.body.contactId.trim() : null;
    const toEmailInput = typeof req.body?.toEmail === 'string' ? req.body.toEmail.trim() : '';
    const cc = Array.isArray(req.body?.cc)
      ? req.body.cc.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];
    const bcc = Array.isArray(req.body?.bcc)
      ? req.body.bcc.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];
    const replyTo =
      typeof req.body?.replyTo === 'string' && req.body.replyTo.trim().length > 0
        ? req.body.replyTo.trim()
        : undefined;
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt : undefined;
    const planRecommendation = req.body?.recommendation;

    if (!subject) {
      return res.status(400).json({ error: 'Subject is required' });
    }

    if (!body || body.trim().length === 0) {
      return res.status(400).json({ error: 'Body is required' });
    }

    let contact: Contact | null = null;
    if (contactId) {
      contact = await ContactModel.findByOwnerAndId(req.user.id, contactId);
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }
    }

    const recipientEmail = contact?.email?.trim() || toEmailInput;

    if (!recipientEmail || !isValidEmail(recipientEmail)) {
      return res.status(400).json({ error: 'Valid recipient email is required' });
    }

    type RawAttachment = { itemId?: unknown; attachmentFilename?: unknown };
    type NormalizedAttachmentInput = { itemId: string; attachmentFilename?: string | null };
    const attachmentsInput: ExecuteAttachmentInput[] = Array.isArray(req.body?.attachments)
      ? (req.body.attachments as RawAttachment[])
          .map((entry: RawAttachment): NormalizedAttachmentInput => {
            const itemId = typeof entry?.itemId === 'string' ? entry.itemId.trim() : '';
            const attachmentFilename =
              typeof entry?.attachmentFilename === 'string' ? entry.attachmentFilename : null;
            return { itemId, attachmentFilename };
          })
          .filter((entry): entry is ExecuteAttachmentInput => entry.itemId.length > 0)
      : [];

    const resolvedAttachments: ResolvedAttachment[] = [];

    for (const attachmentRequest of attachmentsInput) {
      const item = await ItemModel.findById(attachmentRequest.itemId);
      if (!item) {
        return res.status(404).json({ error: `Attachment item not found: ${attachmentRequest.itemId}` });
      }

      const isOwner = item.owner_id === req.user.id;
      const hasSharedAccess = isOwner
        ? true
        : await ItemAccessModel.userHasAccess(item.id, req.user.id, req.user.email);

      if (!hasSharedAccess) {
        return res.status(403).json({ error: `No access to attachment item ${attachmentRequest.itemId}` });
      }

      const itemAttachments = Array.isArray(item.attachments) ? item.attachments : [];
      if (itemAttachments.length === 0) {
        return res.status(400).json({ error: `Item ${attachmentRequest.itemId} has no attachments` });
      }

      let match = attachmentRequest.attachmentFilename
        ? itemAttachments.find(
            (att) =>
              att.filename === attachmentRequest.attachmentFilename ||
              att.originalname === attachmentRequest.attachmentFilename
          )
        : null;

      if (!match) {
        if (itemAttachments.length === 1) {
          match = itemAttachments[0];
        } else {
          return res.status(400).json({
            error: `Attachment filename required for item ${attachmentRequest.itemId}`,
          });
        }
      }

      if (!match?.filename) {
        return res.status(400).json({
          error: `Attachment metadata missing filename for item ${attachmentRequest.itemId}`,
        });
      }

      resolvedAttachments.push({
        storedFilename: match.filename,
        displayName: match.originalname || match.filename,
        mimetype: match.mimetype,
        itemId: item.id,
        itemTitle: item.title,
      });
    }

    await emailService.sendComposedEmail({
      to: recipientEmail,
      subject,
      bodyText: body,
      cc: cc.length > 0 ? cc : undefined,
      bcc: bcc.length > 0 ? bcc : undefined,
      replyTo,
      attachments:
        resolvedAttachments.length > 0
          ? resolvedAttachments.map((attachment: ResolvedAttachment) => ({
              storedFilename: attachment.storedFilename,
              displayName: attachment.displayName,
              mimetype: attachment.mimetype,
            }))
          : undefined,
    });

    if (contact) {
      await ContactModel.update(req.user.id, contact.id, {
        metadata: {
          ...(contact.metadata ?? {}),
          lastInteraction: new Date().toISOString(),
          lastInteractionSubject: subject,
        },
      });
    }

    const metadata = {
      sentAt: new Date().toISOString(),
      to: recipientEmail,
      cc,
      bcc,
      replyTo: replyTo ?? null,
      contactId: contact?.id ?? null,
      prompt,
      planRecommendation,
      attachments: resolvedAttachments.map((attachment) => ({
        itemId: attachment.itemId,
        storedFilename: attachment.storedFilename,
        displayName: attachment.displayName,
        mimetype: attachment.mimetype ?? null,
        itemTitle: attachment.itemTitle ?? null,
      })),
    };

    const savedItem = await ItemModel.create({
      owner_id: req.user.id,
      type: 'email',
      title: subject,
      description: body,
      source: 'send_workflow:outbound',
      raw: JSON.stringify(metadata),
    });

    indexingService.indexItem(savedItem).catch((error: unknown) => {
      console.warn('[Send] Failed to index outbound email item', error);
    });

    res.json({
      success: true,
      sentAt: metadata.sentAt,
      itemId: savedItem.id,
      contact: contact ? sanitizeContact(contact) : null,
    });
  } catch (error) {
    console.error('[Send] Failed to execute outbound email', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

export default router;
