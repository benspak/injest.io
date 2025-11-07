import dotenv from 'dotenv';
import pool from '../config/database.js';
import { ItemModel } from '../models/Item.js';
import { TaskModel } from '../models/Task.js';
import { fileStorageService } from '../services/storage.js';
dotenv.config();
function parseArgs() {
    const args = process.argv.slice(2);
    const userFlagIndex = args.findIndex((arg) => arg === '--user');
    const emailFlagIndex = args.findIndex((arg) => arg === '--email');
    const hardDelete = args.includes('--hard');
    const skipFiles = args.includes('--skip-files');
    const execute = args.includes('--execute');
    let identifier;
    if (userFlagIndex !== -1 && args[userFlagIndex + 1]) {
        identifier = args[userFlagIndex + 1];
    }
    else if (emailFlagIndex !== -1 && args[emailFlagIndex + 1]) {
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
function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
async function resolveUserIdentifier(identifier) {
    if (identifier.includes('@')) {
        const { rows } = await pool.query('SELECT id, email FROM users WHERE lower(email) = lower($1) LIMIT 1', [identifier]);
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
    const { rows } = await pool.query('SELECT id, email FROM users WHERE id = $1 LIMIT 1', [identifier]);
    if (rows.length === 0) {
        console.error(`Error: No user found with ID "${identifier}".`);
        process.exit(1);
    }
    return { userId: rows[0].id, email: rows[0].email };
}
function parseAttachments(raw) {
    if (!raw) {
        return [];
    }
    if (Array.isArray(raw)) {
        return raw;
    }
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        }
        catch {
            return [];
        }
    }
    return [];
}
async function deleteFiles(attachments) {
    for (const attachment of attachments) {
        if (!attachment?.filename) {
            continue;
        }
        try {
            await fileStorageService.deleteFile(attachment.filename);
            console.log(`   ✓ Deleted file: ${attachment.filename}`);
        }
        catch (error) {
            console.warn(`   ⚠ Failed to delete file ${attachment.filename}: ${error.message}`);
        }
    }
}
async function deleteTasks(itemId, execute) {
    const result = await pool.query('SELECT id FROM tasks WHERE item_id = $1', [itemId]);
    const tasks = result.rows;
    if (!execute || tasks.length === 0) {
        return tasks.length;
    }
    for (const task of tasks) {
        await TaskModel.delete(task.id);
    }
    return tasks.length;
}
async function hardDeleteItem(itemId) {
    await pool.query('DELETE FROM items WHERE id = $1', [itemId]);
}
async function softDeleteItem(itemId) {
    await ItemModel.delete(itemId);
}
async function deleteUserItems(options) {
    const { userId, email } = await resolveUserIdentifier(options.userInput);
    console.log('=== Delete User Items ===');
    console.log(`User: ${email ?? userId}`);
    if (email) {
        console.log(`User ID: ${userId}`);
    }
    console.log(`Mode: ${options.execute ? 'Execute' : 'Dry-run'}`);
    console.log(`Deletion type: ${options.hardDelete ? 'Hard delete' : 'Soft delete'}`);
    console.log(`Delete files: ${options.skipFiles ? 'No' : 'Yes'}`);
    const result = await pool.query('SELECT * FROM items WHERE owner_id = $1', [userId]);
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
        }
        else {
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
        }
        else {
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
    }
    catch (error) {
        console.error('Error deleting user items:', error);
        process.exitCode = 1;
    }
    finally {
        await pool.end();
    }
}
void main();
//# sourceMappingURL=deleteUserItems.js.map