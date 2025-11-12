import dotenv from 'dotenv';
import path from 'path';

import pool from '../config/database.js';
import { ContactModel, contactNormalizers } from '../models/Contact.js';
import type { AttachmentMetadata } from '../models/Item.js';
import { contactExtractor } from '../services/contactExtractor.js';
import { fileParserService } from '../services/fileParser.js';
import { indexingService } from '../services/indexing.js';

dotenv.config();

interface ScriptOptions {
  ownerId: string | null;
  itemId: string | null;
  batchSize: number;
  skipExisting: boolean;
  enforceImageFilter: boolean;
}

interface Cursor {
  createdAt: string;
  id: string;
}

interface ItemRow {
  id: string;
  owner_id: string;
  title?: string | null;
  description?: string | null;
  clean?: string | null;
  attachments: unknown;
  created_at: string | Date;
}

interface AggregatedCandidate {
  name: string | null;
  email: string | null;
  metadata: Record<string, unknown>;
  sources: Record<string, unknown>[];
}

interface ProcessStats {
  batches: number;
  itemsExamined: number;
  itemsFailed: number;
  itemsWithContacts: number;
  itemsWithoutContacts: number;
  attachmentsProcessed: number;
  contactsUpserted: number;
}

interface ProcessResult {
  attachmentsProcessed: number;
  contactsUpserted: number;
  foundContacts: boolean;
}

const DEFAULT_BATCH_SIZE = 25;
const TEXT_SAMPLE_LENGTH = 240;
const RUN_ID = `extractContactsFromOcrImages:${new Date().toISOString()}`;

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.bmp',
  '.webp',
  '.tiff',
  '.tif',
  '.heic',
]);

function resolveBatchSize(): number {
  const raw = process.env.CONTACT_EXTRACTION_BATCH_SIZE;
  if (!raw) {
    return DEFAULT_BATCH_SIZE;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    console.warn(
      `[ContactsScript] Invalid CONTACT_EXTRACTION_BATCH_SIZE="${raw}". Falling back to ${DEFAULT_BATCH_SIZE}.`
    );
    return DEFAULT_BATCH_SIZE;
  }

  return parsed;
}

function normalizeEnvValue(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const resolvedItemId = normalizeEnvValue(process.env.CONTACT_EXTRACTION_ITEM_ID);
const resolvedOwnerId = normalizeEnvValue(process.env.CONTACT_EXTRACTION_OWNER_ID);
const forceProcessing = process.env.CONTACT_EXTRACTION_FORCE === 'true';
const enforceImageFilter =
  process.env.CONTACT_EXTRACTION_REQUIRE_IMAGE_FILTER !== 'false';

const scriptOptions: ScriptOptions = {
  ownerId: resolvedOwnerId,
  itemId: resolvedItemId,
  batchSize: resolveBatchSize(),
  skipExisting:
    !forceProcessing &&
    !resolvedItemId &&
    process.env.CONTACT_EXTRACTION_SKIP_EXISTING === 'false'
      ? false
      : !forceProcessing && !resolvedItemId,
  enforceImageFilter,
};

const scriptStartedAt = new Date();

function isMeaningfulText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function sanitizeValue(value?: string | null): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildAggregateKey(_name?: string | null, email?: string | null): string {
  return contactNormalizers.email(sanitizeValue(email));
}

function parseAttachments(raw: unknown): AttachmentMetadata[] {
  if (!raw) {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw as AttachmentMetadata[];
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as AttachmentMetadata[];
      }
    } catch (error) {
      console.warn('[ContactsScript] Failed to parse attachments JSON:', error);
    }
  }

  return [];
}

function isImageAttachment(attachment: AttachmentMetadata): boolean {
  const mimetype = (attachment.mimetype ?? '').toLowerCase();
  if (mimetype.startsWith('image/')) {
    return true;
  }

  const candidate =
    (attachment.originalname ?? attachment.filename ?? '').toLowerCase();
  const extension = path.extname(candidate);
  return IMAGE_EXTENSIONS.has(extension);
}

function truncateSample(value: string): string {
  if (value.length <= TEXT_SAMPLE_LENGTH) {
    return value;
  }
  return `${value.substring(0, TEXT_SAMPLE_LENGTH)}…`;
}

function addCandidatesFromText(
  collection: Map<string, AggregatedCandidate>,
  text: string,
  context: Record<string, unknown>
): void {
  if (!isMeaningfulText(text)) {
    return;
  }

  const candidates = contactExtractor.extract(text);
  candidates.forEach((candidate) => {
    const key = buildAggregateKey(candidate.name, candidate.email);
    if (!key) {
      return;
    }

    const sanitizedName = sanitizeValue(candidate.name);
    const sanitizedEmail = sanitizeValue(candidate.email);
    const existing = collection.get(key);

    const mergedMetadata: Record<string, unknown> = {
      ...(existing?.metadata ?? {}),
      ...(candidate.metadata ?? {}),
    };

    const mergedSources = existing?.sources ? [...existing.sources] : [];
    mergedSources.push({
      ...context,
      extractor: candidate.metadata ?? null,
    });

    collection.set(key, {
      name: sanitizedName ?? existing?.name ?? null,
      email: sanitizedEmail ?? existing?.email ?? null,
      metadata: mergedMetadata,
      sources: mergedSources,
    });
  });
}

async function processAttachment(
  item: ItemRow,
  attachment: AttachmentMetadata,
  attachmentIndex: number,
  aggregation: Map<string, AggregatedCandidate>
): Promise<number> {
  if (!attachment?.filename) {
    return 0;
  }

  try {
    const parsed = await fileParserService.parseFile(
      attachment.filename,
      attachment.mimetype
    );

    const text = sanitizeValue(parsed.text ?? '');
    if (!text) {
      return 0;
    }

    addCandidatesFromText(aggregation, text, {
      type: 'attachment',
      attachmentFilename: attachment.filename,
      attachmentOriginalName: attachment.originalname ?? null,
      attachmentIndex,
      parserSource: parsed.metadata?.source ?? 'ocr',
      textSample: truncateSample(text),
      itemId: item.id,
      itemTitle: item.title ?? null,
      scriptRunId: RUN_ID,
    });

    return 1;
  } catch (error) {
    console.error(
      `[ContactsScript] Failed to parse attachment "${attachment.filename}" for item ${item.id}:`,
      error
    );
    return 0;
  }
}

async function processItem(item: ItemRow): Promise<ProcessResult> {
  const aggregation = new Map<string, AggregatedCandidate>();
  const attachments = parseAttachments(item.attachments);
  const imageAttachments = attachments.filter(isImageAttachment);
  let attachmentsProcessed = 0;

  for (const [index, attachment] of imageAttachments.entries()) {
    // eslint-disable-next-line no-await-in-loop
    attachmentsProcessed += await processAttachment(item, attachment, index, aggregation);
  }

  if (isMeaningfulText(item.description)) {
    addCandidatesFromText(aggregation, item.description, {
      type: 'item-description',
      field: 'description',
      textSample: truncateSample(item.description),
      itemId: item.id,
      itemTitle: item.title ?? null,
      scriptRunId: RUN_ID,
    });
  }

  if (isMeaningfulText(item.clean) && item.clean !== item.description) {
    addCandidatesFromText(aggregation, item.clean, {
      type: 'item-clean',
      field: 'clean',
      textSample: truncateSample(item.clean),
      itemId: item.id,
      itemTitle: item.title ?? null,
      scriptRunId: RUN_ID,
    });
  }

  if (aggregation.size === 0) {
    return {
      attachmentsProcessed,
      contactsUpserted: 0,
      foundContacts: false,
    };
  }

  const inputs = Array.from(aggregation.values()).map((aggregated) => ({
    ownerId: item.owner_id,
    name: aggregated.name ?? undefined,
    email: aggregated.email ?? undefined,
    sourceItemId: item.id,
    metadata: {
      ...(aggregated.metadata ?? {}),
      extractContactsFromOcrImages: {
        runId: RUN_ID,
        updatedAt: new Date().toISOString(),
        itemId: item.id,
        itemTitle: item.title ?? null,
        sources: aggregated.sources,
      },
    },
  }));

  const contacts = await ContactModel.upsertMany(inputs);
  if (contacts.length > 0) {
    await Promise.all(
      contacts.map(async (contact) => {
        try {
          await indexingService.indexContact(contact);
        } catch (error) {
          console.warn('[ContactsScript] Failed to index contact:', {
            contactId: contact.id,
            error,
          });
        }
      })
    );
  }

  return {
    attachmentsProcessed,
    contactsUpserted: contacts.length,
    foundContacts: contacts.length > 0,
  };
}

function buildFetchQuery(
  cursor: Cursor | null,
  limit: number
): { text: string; values: unknown[] } {
  if (scriptOptions.itemId) {
    const values: unknown[] = [scriptOptions.itemId];
    let text = `
      SELECT id, owner_id, title, description, clean, attachments, created_at
      FROM items
      WHERE id = $1
    `;

    if (scriptOptions.ownerId) {
      values.push(scriptOptions.ownerId);
      text += ' AND owner_id = $2';
    }

    text += ' LIMIT 1';
    return { text, values };
  }

  const values: unknown[] = [];
  const conditions: string[] = ['deleted_at IS NULL', 'attachments IS NOT NULL'];

  conditions.push('jsonb_array_length(attachments) > 0');

  if (scriptOptions.enforceImageFilter) {
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements(attachments) AS attachment
        WHERE COALESCE(attachment->>'mimetype', '') ILIKE 'image/%'
          OR COALESCE(attachment->>'filename', '') ~* '\\.(png|jpe?g|gif|bmp|webp|tiff|heic)$'
          OR COALESCE(attachment->>'originalname', '') ~* '\\.(png|jpe?g|gif|bmp|webp|tiff|heic)$'
      )
    `);
  }

  if (scriptOptions.ownerId) {
    values.push(scriptOptions.ownerId);
    conditions.push(`owner_id = $${values.length}`);
  }

  if (scriptOptions.skipExisting) {
    conditions.push(`NOT EXISTS (SELECT 1 FROM contacts WHERE source_item_id = items.id)`);
  }

  if (cursor) {
    values.push(cursor.createdAt);
    const createdAtIndex = values.length;
    values.push(cursor.id);
    const idIndex = values.length;
    conditions.push(
      `(created_at, id) > ($${createdAtIndex}::timestamptz, $${idIndex}::uuid)`
    );
  }

  values.push(limit);
  const limitIndex = values.length;

  const text = `
    SELECT id, owner_id, title, description, clean, attachments, created_at
    FROM items
    WHERE ${conditions.join('\n      AND ')}
    ORDER BY created_at, id
    LIMIT $${limitIndex}
  `;

  return { text, values };
}

async function fetchNextBatch(
  cursor: Cursor | null,
  limit: number
): Promise<{ rows: ItemRow[]; nextCursor: Cursor | null }> {
  const { text, values } = buildFetchQuery(cursor, limit);
  const result = await pool.query<ItemRow>(text, values);

  if (!result.rowCount) {
    return { rows: [], nextCursor: null };
  }

  const rows = result.rows;
  if (scriptOptions.itemId) {
    return { rows, nextCursor: null };
  }

  const lastRow = rows[rows.length - 1];
  const createdAt =
    lastRow.created_at instanceof Date
      ? lastRow.created_at.toISOString()
      : new Date(lastRow.created_at).toISOString();

  return {
    rows,
    nextCursor: {
      id: lastRow.id,
      createdAt,
    },
  };
}

async function main(): Promise<void> {
  const stats: ProcessStats = {
    batches: 0,
    itemsExamined: 0,
    itemsFailed: 0,
    itemsWithContacts: 0,
    itemsWithoutContacts: 0,
    attachmentsProcessed: 0,
    contactsUpserted: 0,
  };

  console.log('[ContactsScript] Starting contact extraction job', {
    startedAt: scriptStartedAt.toISOString(),
    runId: RUN_ID,
    options: scriptOptions,
  });

  let cursor: Cursor | null = null;

  try {
    while (true) {
      const { rows, nextCursor } = await fetchNextBatch(
        cursor,
        scriptOptions.batchSize
      );

      if (!rows.length) {
        break;
      }

      stats.batches += 1;
      console.log(
        `[ContactsScript] Processing batch ${stats.batches} (${rows.length} items)`
      );

      for (const item of rows) {
        stats.itemsExamined += 1;
        try {
          // eslint-disable-next-line no-await-in-loop
          const result = await processItem(item);
          stats.attachmentsProcessed += result.attachmentsProcessed;
          stats.contactsUpserted += result.contactsUpserted;
          if (result.foundContacts) {
            stats.itemsWithContacts += 1;
          } else {
            stats.itemsWithoutContacts += 1;
          }
        } catch (error) {
          stats.itemsFailed += 1;
          console.error(
            `[ContactsScript] Failed to process item ${item.id}:`,
            error
          );
        }
      }

      if (scriptOptions.itemId) {
        break;
      }

      cursor = nextCursor;
      if (!cursor) {
        break;
      }
    }
  } catch (error) {
    console.error('[ContactsScript] Job failed with unexpected error:', error);
    process.exitCode = 1;
  } finally {
    const finishedAt = new Date();
    console.log('[ContactsScript] Job complete', {
      runId: RUN_ID,
      startedAt: scriptStartedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - scriptStartedAt.getTime(),
      stats,
    });

    await pool.end().catch((poolError) => {
      console.error('[ContactsScript] Failed to close database pool:', poolError);
    });
  }
}

void main();
