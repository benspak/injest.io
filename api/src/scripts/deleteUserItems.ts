import dotenv from 'dotenv';
import pool from '../config/database.js';
import { ItemModel, Item } from '../models/Item.js';
import { TaskModel } from '../models/Task.js';
import { fileStorageService } from '../services/storage.js';

dotenv.config();

/**
 * Delete every item belonging to a user.
 *
 * Usage (dry run):
 *   npx tsx src/scripts/deleteUserItems.ts --user <USER_ID>
 *
 * Execute (soft delete + remove attachments):
 *   npx tsx src/scripts/deleteUserItems.ts --user <USER_ID> --execute
 *
 * Execute with hard delete (removes DB rows entirely):
 *   npx tsx src/scripts/deleteUserItems.ts --user <USER_ID> --execute --hard
 *
 * Skip file deletion:
 *   npx tsx src/scripts/deleteUserItems.ts --user <USER_ID> --execute --skip-files
 *
 * Note: Because the API uses ES modules, run scripts with `tsx` (or `node --loader ts-node/esm`)
 * so that `.ts` sources can resolve `*.js` imports produced by the build output.
 */

type DeleteOptions = {
  userInput: string;
  execute: boolean;
  hardDelete: boolean;
  skipFiles: boolean;
};

type ItemRecord = Omit<Item, 'attachments'> & {
  attachments?: any[] | string | null;
};

type Attachment = {
  filename: string;
  originalname?: string;
};

function parseArgs(): DeleteOptions {
  const args = process.argv.slice(2);
  const userFlagIndex = args.findIndex((arg) => arg === '--user');
  const emailFlagIndex = args.findIndex((arg) => arg === '--email');
  const hardDelete = args.includes('--hard');
  const skipFiles = args.includes('--skip-files');
  const execute = args.includes('--execute');

  let identifier: string | undefined;
  if (userFlagIndex !== -1 && args[userFlagIndex + 1]) {
    identifier = args[userFlagIndex + 1];
  } else if (emailFlagIndex !== -1 && args[emailFlagIndex + 1]) {
    identifier = args[emailFlagIndex + 1];
  }

  if (!identifier) {
    console.error('Error: Provide a user identifier via --user <UUID> or --email <EMAIL>.');
    process.exit(1);
  }

  if (hardDelete && !execute) {
    console.warn('Warning: --hard has no effect without --execute. Running in dry-run mode.');
  }

  return { userInput: identifier, execute, hardDelete: hardDelete && execute, skipFiles };
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
      console.error(`Error: No user found with email "${identifier}".`);
      process.exit(1);
    }

    return { userId: rows[0].id, email: rows[0].email };
  }

  if (!isUuid(identifier)) {
    console.error('Error: --user must be a valid UUID or email address.');
    process.exit(1);
  }

  const { rows } = await pool.query<{ id: string; email: string | null }>(
    'SELECT id, email FROM users WHERE id = $1 LIMIT 1',
    [identifier],
  );

  if (rows.length === 0) {
    console.error(`Error: No user found with ID "${identifier}".`);
    process.exit(1);
  }

  return { userId: rows[0].id, email: rows[0].email };
}

function parseAttachments(raw: ItemRecord['attachments']): Attachment[] {
  if (!raw) {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw as Attachment[];
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Attachment[]) : [];
    } catch {
      return [];
    }
  }

  return [];
}

async function deleteFiles(attachments: Attachment[]): Promise<void> {
  for (const attachment of attachments) {
    if (!attachment?.filename) {
      continue;
    }

    try {
      await fileStorageService.deleteFile(attachment.filename);
      console.log(`   ✓ Deleted file: ${attachment.filename}`);
    } catch (error: any) {
      console.warn(`   ⚠ Failed to delete file ${attachment.filename}: ${error.message}`);
    }
  }
}

async function deleteTasks(itemId: string, execute: boolean): Promise<number> {
  const result = await pool.query('SELECT id FROM tasks WHERE item_id = $1', [itemId]);
  const tasks = result.rows as Array<{ id: string }>;

  if (!execute || tasks.length === 0) {
    return tasks.length;
  }

  for (const task of tasks) {
    await TaskModel.delete(task.id);
  }

  return tasks.length;
}

async function hardDeleteItem(itemId: string): Promise<void> {
  await pool.query('DELETE FROM items WHERE id = $1', [itemId]);
}

async function softDeleteItem(itemId: string): Promise<void> {
  await ItemModel.delete(itemId);
}

async function deleteUserItems(options: DeleteOptions): Promise<void> {
  const { userId, email } = await resolveUserIdentifier(options.userInput);

  console.log('=== Delete User Items ===');
  console.log(`User: ${email ?? userId}`);
  if (email) {
    console.log(`User ID: ${userId}`);
  }
  console.log(`Mode: ${options.execute ? 'Execute' : 'Dry-run'}`);
  console.log(`Deletion type: ${options.hardDelete ? 'Hard delete' : 'Soft delete'}`);
  console.log(`Delete files: ${options.skipFiles ? 'No' : 'Yes'}`);

  const result = await pool.query<ItemRecord>(
    'SELECT * FROM items WHERE owner_id = $1',
    [userId],
  );

  const items = result.rows;

  if (items.length === 0) {
    console.log('No items found for this user.');
    return;
  }

  console.log(`Found ${items.length} item(s).`);

  let totalAttachments = 0;
  let deletedAttachments = 0;
  let deletedTasks = 0;

  for (const item of items) {
    console.log('\n----------------------------------------');
    console.log(`Item: ${item.id}`);

    const attachments = parseAttachments(item.attachments);
    totalAttachments += attachments.length;

    if (attachments.length > 0) {
      console.log(` - Attachments: ${attachments.length}`);
      attachments.forEach((attachment, index) => {
        console.log(`   [${index + 1}] ${attachment.filename}${attachment.originalname ? ` (${attachment.originalname})` : ''}`);
      });
    } else {
      console.log(' - Attachments: none');
    }

    const taskCount = await deleteTasks(item.id, false);
    if (taskCount > 0) {
      console.log(` - Related tasks: ${taskCount}`);
    }

    if (!options.execute) {
      continue;
    }

    const removedTasks = await deleteTasks(item.id, true);
    deletedTasks += removedTasks;

    if (!options.skipFiles && attachments.length > 0) {
      await deleteFiles(attachments);
      deletedAttachments += attachments.length;
    }

    if (options.hardDelete) {
      await hardDeleteItem(item.id);
    } else {
      await softDeleteItem(item.id);
    }

    console.log(`   ✓ ${options.hardDelete ? 'Hard' : 'Soft'} deleted item ${item.id}`);
  }

  console.log('\n=== Summary ===');
  console.log(`Items processed: ${items.length}`);
  console.log(`Attachments found: ${totalAttachments}`);
  if (options.execute && !options.skipFiles) {
    console.log(`Attachments deleted: ${deletedAttachments}`);
  }
  console.log(`Tasks deleted: ${options.execute ? deletedTasks : '0 (dry-run)'}`);
  console.log(`Operation complete.`);
}

async function main() {
  const options = parseArgs();

  try {
    await deleteUserItems(options);
  } catch (error) {
    console.error('Error deleting user items:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
