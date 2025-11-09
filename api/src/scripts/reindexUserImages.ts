import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';
import { ItemModel, type Item, type AttachmentMetadata } from '../models/Item.js';
import { fileStorageService } from '../services/storage.js';
import { fileParserService } from '../services/fileParser.js';
import { indexingService } from '../services/indexing.js';
import {
  sanitizeOriginalFilename,
  normalizeAttachments,
  normalizeItem,
} from '../utils/itemNormalization.js';

dotenv.config();

type ReindexOptions = {
  userInput: string;
  execute: boolean;
  hydrateMetadata: boolean;
  overwriteMetadata: boolean;
  limit?: number;
  skipMissingFiles: boolean;
};

type ItemRecord = Omit<Item, 'attachments'> & {
  attachments?: AttachmentMetadata[] | string | null;
};

type ParsedAttachment = AttachmentMetadata & {
  __sourceIndex?: number;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function printUsage(): never {
  const scriptName = path.relative(
    process.cwd(),
    path.join(__dirname, 'reindexUserImages.ts')
  );

  // eslint-disable-next-line no-console
  console.log(`
Reindex a user's image-based items by regenerating metadata (optional) and embeddings.

Usage:
  npx tsx ${scriptName} --user <USER_ID>
  npx tsx ${scriptName} --email <EMAIL>

Flags:
  --execute            Perform updates. Without this flag, runs in dry-run mode.
  --hydrate-metadata   Regenerate title/description from the image when missing.
  --overwrite          Replace existing title/description when regenerating metadata (requires --hydrate-metadata).
  --skip-missing       Skip items whose files are missing instead of stopping with an error.
  --limit <number>     Only process the first <number> matching items (after sorting by created_at desc).

Examples:
  Dry run by email:
    npx tsx ${scriptName} --email user@example.com

  Execute full reindex with metadata hydration:
    npx tsx ${scriptName} --user 123e4567-e89b-12d3-a456-426614174000 --execute --hydrate-metadata
`);
  process.exit(1);
}

function parseArgs(): ReindexOptions {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
  }

  const execute = args.includes('--execute');
  const hydrateMetadata = args.includes('--hydrate-metadata');
  const overwriteMetadata = args.includes('--overwrite');
  const skipMissingFiles = args.includes('--skip-missing');

  if (overwriteMetadata && !hydrateMetadata) {
    // eslint-disable-next-line no-console
    console.warn('Warning: --overwrite has no effect without --hydrate-metadata; ignoring.');
  }

  const findArgValue = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    if (idx !== -1 && idx + 1 < args.length) {
      return args[idx + 1];
    }
    return undefined;
  };

  const userInput = findArgValue('--user');
  const emailInput = findArgValue('--email');

  if (!userInput && !emailInput) {
    printUsage();
  }

  const limitValue = findArgValue('--limit');
  let limit: number | undefined;
  if (limitValue) {
    const parsed = Number.parseInt(limitValue, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      throw new Error(`Invalid --limit value "${limitValue}". Must be a positive integer.`);
    }
    limit = parsed;
  }

  return {
    userInput: userInput ?? emailInput ?? '',
    execute,
    hydrateMetadata,
    overwriteMetadata: hydrateMetadata ? overwriteMetadata : false,
    limit,
    skipMissingFiles,
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function resolveUserIdentifier(identifier: string): Promise<{ userId: string; email?: string | null }> {
  if (identifier.includes('@')) {
    const { rows } = await pool.query<{ id: string; email: string }>(
      'SELECT id, email FROM users WHERE lower(email) = lower($1) LIMIT 1',
      [identifier],
    );

    if (rows.length === 0) {
      throw new Error(`No user found with email "${identifier}".`);
    }

    return { userId: rows[0].id, email: rows[0].email };
  }

  if (!isUuid(identifier)) {
    throw new Error('Provide a valid user UUID via --user or an email via --email.');
  }

  const { rows } = await pool.query<{ id: string; email: string | null }>(
    'SELECT id, email FROM users WHERE id = $1 LIMIT 1',
    [identifier],
  );

  if (rows.length === 0) {
    throw new Error(`No user found with ID "${identifier}".`);
  }

  return { userId: rows[0].id, email: rows[0].email };
}

function parseAttachments(raw: ItemRecord['attachments']): ParsedAttachment[] {
  if (!raw) {
    return [];
  }

  let parsed: AttachmentMetadata[] | null = null;

  if (Array.isArray(raw)) {
    parsed = raw as AttachmentMetadata[];
  } else if (typeof raw === 'string') {
    try {
      const maybeArray = JSON.parse(raw);
      parsed = Array.isArray(maybeArray) ? (maybeArray as AttachmentMetadata[]) : null;
    } catch {
      parsed = null;
    }
  } else if (typeof raw === 'object') {
    parsed = normalizeAttachments(raw);
  }

  if (!parsed) {
    return [];
  }

  return parsed.map((attachment, index) => {
    if (!attachment.originalname && attachment.filename) {
      return {
        ...attachment,
        originalname: sanitizeOriginalFilename(path.basename(attachment.filename)),
        __sourceIndex: index,
      };
    }
    return {
      ...attachment,
      __sourceIndex: index,
    };
  });
}

function guessMimeType(filename: string): string | undefined {
  const ext = path.extname(filename).toLowerCase();
  if (!ext) {
    return undefined;
  }
  const lookup: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
    '.heic': 'image/heic',
    '.svg': 'image/svg+xml',
  };
  return lookup[ext];
}

function isImageAttachment(attachment: AttachmentMetadata): boolean {
  if (attachment.mimetype && attachment.mimetype.startsWith('image/')) {
    return true;
  }
  const guessed = guessMimeType(attachment.filename ?? attachment.originalname ?? '');
  return !!guessed;
}

async function findExistingFile(attachment: AttachmentMetadata): Promise<{ filename: string; exists: boolean }> {
  if (!attachment.filename) {
    return { filename: '', exists: false };
  }

  const primaryPath = fileStorageService.getFilePath(attachment.filename);
  if (fs.existsSync(primaryPath)) {
    return { filename: attachment.filename, exists: true };
  }

  if (attachment.originalname) {
    const candidate = sanitizeOriginalFilename(attachment.originalname);
    const candidatePath = fileStorageService.getFilePath(candidate);
    if (fs.existsSync(candidatePath)) {
      return { filename: candidate, exists: true };
    }
  }

  return { filename: attachment.filename, exists: false };
}

async function reindexItem(
  item: ItemRecord,
  attachments: ParsedAttachment[],
  options: ReindexOptions,
): Promise<void> {
  const existingItem = normalizeItem(item as Item);
  const imageAttachments = attachments.filter((att) => isImageAttachment(att));

  if (imageAttachments.length === 0) {
    // eslint-disable-next-line no-console
    console.log(`Skipping item ${item.id}: no image attachments.`);
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`\nItem ${item.id}`);
  // eslint-disable-next-line no-console
  console.log(` - Existing title       : ${existingItem.title ?? '(none)'}`);
  // eslint-disable-next-line no-console
  console.log(` - Existing description : ${existingItem.description?.slice(0, 80) ?? '(none)'}`);
  // eslint-disable-next-line no-console
  console.log(` - Attachments          : ${attachments.length} (images: ${imageAttachments.length})`);

  const attachmentsUpdates: AttachmentMetadata[] = [...attachments];

  for (const attachment of imageAttachments) {
    const lookup = await findExistingFile(attachment);
    if (!lookup.exists) {
      const message = `   ⚠ Missing file on disk: ${attachment.filename}`;
      if (options.skipMissingFiles) {
        // eslint-disable-next-line no-console
        console.warn(message);
        continue;
      }
      throw new Error(message);
    }

    const normalizedFilename = lookup.filename;
    const mimetype =
      attachment.mimetype && attachment.mimetype.startsWith('image/')
        ? attachment.mimetype
        : guessMimeType(normalizedFilename) ?? attachment.mimetype;

    // eslint-disable-next-line no-console
    console.log(`   ✓ Found ${normalizedFilename} (${mimetype ?? 'unknown mimetype'})`);

    if (options.execute) {
      const sourceIndex = attachment.__sourceIndex ?? attachments.indexOf(attachment);
      if (sourceIndex !== -1) {
        attachmentsUpdates[sourceIndex] = {
          ...attachmentsUpdates[sourceIndex],
          filename: normalizedFilename,
          mimetype: mimetype ?? attachmentsUpdates[sourceIndex]?.mimetype,
          originalname: sanitizeOriginalFilename(
            attachmentsUpdates[sourceIndex]?.originalname ?? normalizedFilename
          ),
        };
      }
    }
  }

  if (!options.execute) {
    // Dry run: stop after validations.
    return;
  }

  const firstImage = imageAttachments[0];
  const firstImageIndex = firstImage.__sourceIndex ?? attachments.indexOf(firstImage);
  const attachmentForParsing =
    firstImageIndex !== -1 ? attachmentsUpdates[firstImageIndex] : firstImage;

  const filenameForParsing =
    attachmentForParsing?.filename ??
    attachmentForParsing?.originalname ??
    firstImage.filename ??
    firstImage.originalname ??
    '';

  if (!filenameForParsing) {
    // eslint-disable-next-line no-console
    console.warn('   ⚠ Cannot determine filename for parsing; skipping item.');
    return;
  }

  const filePath = fileStorageService.getFilePath(filenameForParsing);

  if (!fs.existsSync(filePath)) {
    if (options.skipMissingFiles) {
      // eslint-disable-next-line no-console
      console.warn(`   ⚠ Skipping reindex: cannot locate file for ${filenameForParsing}.`);
      return;
    }
    throw new Error(`File ${filenameForParsing} not found when attempting to parse.`);
  }

  let parsedContent:
    | {
        text: string;
        title?: string;
        metadata?: { source?: 'ocr' | 'vision' };
      }
    | null = null;

  if (options.hydrateMetadata) {
    try {
      parsedContent = await fileParserService.parseFile(
        filenameForParsing,
        attachmentForParsing?.mimetype ?? firstImage.mimetype,
      );
      // eslint-disable-next-line no-console
      console.log(
        `   ✓ Parsed image via ${parsedContent.metadata?.source?.toUpperCase() ?? 'UNKNOWN'}`
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.warn(`   ⚠ Failed to parse image for metadata: ${message}`);
      parsedContent = null;
    }
  }

  const updates: Partial<Item> = {};

  const existingTitle = existingItem.title?.trim();
  const existingDescription = existingItem.description?.trim();

  if (options.hydrateMetadata) {
    const candidateTitle =
      parsedContent?.title ||
      (firstImage.originalname
        ? path.basename(firstImage.originalname, path.extname(firstImage.originalname))
        : undefined);

    const candidateDescription = parsedContent?.text?.trim();

    if (!existingTitle || options.overwriteMetadata) {
      if (candidateTitle && candidateTitle !== existingTitle) {
        updates.title = candidateTitle;
      }
    }

    if (!existingDescription || options.overwriteMetadata) {
      if (candidateDescription && candidateDescription !== existingDescription) {
        updates.description = candidateDescription;
      }
    }
  }

  const updatedAttachments = attachmentsUpdates.map(({ __sourceIndex, ...rest }) => rest);
  updates.attachments = updatedAttachments;

  if (Object.keys(updates).length > 0) {
    const updated = await ItemModel.update(item.id, updates);
    // eslint-disable-next-line no-console
    console.log(`   ✓ Updated item metadata (title/description/attachments).`);
    Object.assign(item, updated);
  }

  await indexingService.indexItem(item.id, { retries: 3 });
  // eslint-disable-next-line no-console
  console.log('   ✓ Reindexed item and regenerated embeddings.');
}

async function reindexUserImages(options: ReindexOptions): Promise<void> {
  const { userId, email } = await resolveUserIdentifier(options.userInput);

  // eslint-disable-next-line no-console
  console.log('=== Reindex User Images ===');
  // eslint-disable-next-line no-console
  console.log(`User: ${email ?? userId}`);
  if (email) {
    // eslint-disable-next-line no-console
    console.log(`User ID: ${userId}`);
  }
  // eslint-disable-next-line no-console
  console.log(`Mode: ${options.execute ? 'EXECUTE' : 'DRY RUN'}`);
  // eslint-disable-next-line no-console
  console.log(`Hydrate metadata: ${options.hydrateMetadata ? 'Yes' : 'No'}`);
  if (options.hydrateMetadata) {
    // eslint-disable-next-line no-console
    console.log(`Overwrite metadata: ${options.overwriteMetadata ? 'Yes' : 'No'}`);
  }
  // eslint-disable-next-line no-console
  console.log(`Skip missing files: ${options.skipMissingFiles ? 'Yes' : 'No'}`);
  if (options.limit) {
    // eslint-disable-next-line no-console
    console.log(`Limit: ${options.limit}`);
  }

  const queryParts: string[] = [
    'SELECT * FROM items',
    'WHERE owner_id = $1',
    'AND deleted_at IS NULL',
    'AND attachments IS NOT NULL',
    'ORDER BY created_at DESC',
  ];

  if (options.limit) {
    queryParts.push('LIMIT $2');
  }

  const params: Array<string | number> = [userId];
  if (options.limit) {
    params.push(options.limit);
  }

  const { rows } = await pool.query<ItemRecord>(queryParts.join(' '), params);

  if (rows.length === 0) {
    // eslint-disable-next-line no-console
    console.log('No items with attachments found for this user.');
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`Found ${rows.length} item(s) with attachments. Starting processing...`);

  for (const item of rows) {
    try {
      const attachments = parseAttachments(item.attachments);
      if (!attachments.length) {
        // eslint-disable-next-line no-console
        console.log(`\nItem ${item.id}: no parsable attachments; skipping.`);
        continue;
      }

      await reindexItem(item, attachments, options);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error(`   ✗ Error processing item ${item.id}: ${message}`);
    }
  }

  // eslint-disable-next-line no-console
  console.log('\nReindex completed.');
}

async function main() {
  try {
    const options = parseArgs();
    await reindexUserImages(options);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(`Error: ${message}`);
    process.exitCode = 1;
  } finally {
    await pool.end().catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('Warning: Failed to close database pool:', err);
    });
  }
}

void main();
