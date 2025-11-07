import dotenv from 'dotenv';
import path from 'path';
import pool from '../config/database.js';
import { ItemModel } from '../models/Item.js';
import { fileStorageService } from '../services/storage.js';
dotenv.config();
const SUSPICIOUS_PATTERNS = [
    /Ã./g,
    /Â./g,
    /â../g,
    /\uFFFD/,
    /â/g,
    /â€œ/g,
    /â€/g,
    /â€˜/g,
    /â€™/g,
    /â€“/g,
];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg', '.heic', '.heif'];
function decodeOriginalFilename(originalname) {
    if (!originalname) {
        return originalname;
    }
    try {
        const decoded = Buffer.from(originalname, 'binary').toString('utf8');
        if (decoded.includes('\uFFFD')) {
            return originalname;
        }
        return decoded.normalize('NFC');
    }
    catch {
        return originalname;
    }
}
function looksCorrupted(name, aggressive = false) {
    if (!name) {
        return false;
    }
    if (SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(name))) {
        return true;
    }
    if (aggressive) {
        // Try decoding and check if the decoded value is printable ASCII
        const decoded = decodeOriginalFilename(name);
        const asciiDecoded = decoded.replace(/[^\x20-\x7E]/g, '');
        const asciiOriginal = name.replace(/[^\x20-\x7E]/g, '');
        if (decoded !== name && asciiDecoded === asciiOriginal) {
            return true;
        }
    }
    return false;
}
function isImageAttachment(attachment) {
    if (attachment.mimetype?.startsWith('image/')) {
        return true;
    }
    const ext = path.extname(attachment.filename || attachment.originalname || '').toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext);
}
function parseAttachments(rawAttachments) {
    if (!rawAttachments) {
        return [];
    }
    if (Array.isArray(rawAttachments)) {
        return rawAttachments;
    }
    if (typeof rawAttachments === 'string') {
        try {
            const parsed = JSON.parse(rawAttachments);
            return Array.isArray(parsed) ? parsed : [];
        }
        catch {
            return [];
        }
    }
    return [];
}
async function removeCorruptedImages({ dryRun, ownerId, aggressive }) {
    console.log('=== Remove Corrupted Image Attachments ===');
    console.log(`Dry run: ${dryRun ? 'Yes' : 'No'}`);
    if (ownerId) {
        console.log(`Filtering by owner: ${ownerId}`);
    }
    console.log(`Detection mode: ${aggressive ? 'Aggressive' : 'Conservative'}`);
    const conditions = ['attachments IS NOT NULL', "jsonb_array_length(attachments) > 0"];
    const params = [];
    if (ownerId) {
        conditions.push(`owner_id = $${conditions.length + 1}`);
        params.push(ownerId);
    }
    const query = `
    SELECT id, owner_id, attachments
    FROM items
    WHERE ${conditions.join(' AND ')}
  `;
    const result = await pool.query(query, params);
    let totalAttachments = 0;
    let totalCorrupted = 0;
    let itemsUpdated = 0;
    for (const row of result.rows) {
        const attachments = parseAttachments(row.attachments);
        if (attachments.length === 0) {
            continue;
        }
        totalAttachments += attachments.length;
        const corrupted = [];
        const clean = [];
        for (const attachment of attachments) {
            const { filename, originalname } = attachment;
            const corruptedFilename = looksCorrupted(filename, aggressive);
            const corruptedOriginal = looksCorrupted(originalname, aggressive);
            if (isImageAttachment(attachment) && (corruptedFilename || corruptedOriginal)) {
                corrupted.push(attachment);
            }
            else {
                clean.push(attachment);
            }
        }
        if (corrupted.length === 0) {
            continue;
        }
        totalCorrupted += corrupted.length;
        itemsUpdated += 1;
        console.log('\n----------------------------------------');
        console.log(`Item: ${row.id} (owner: ${row.owner_id})`);
        console.log(` - Total attachments: ${attachments.length}`);
        console.log(` - Corrupted detected: ${corrupted.length}`);
        corrupted.forEach((attachment, index) => {
            console.log(`   [${index + 1}] filename: ${attachment.filename}`);
            if (attachment.originalname) {
                console.log(`       original: ${attachment.originalname}`);
            }
            console.log(`       mimetype: ${attachment.mimetype}`);
        });
        if (!dryRun) {
            const updatedAttachments = clean.length > 0 ? clean : null;
            await ItemModel.update(row.id, { attachments: updatedAttachments || undefined });
            for (const attachment of corrupted) {
                try {
                    await fileStorageService.deleteFile(attachment.filename);
                    console.log(`   ✓ Deleted file from storage: ${attachment.filename}`);
                }
                catch (error) {
                    console.warn(`   ⚠ Failed to delete file ${attachment.filename}: ${error.message}`);
                }
            }
        }
    }
    console.log('\n=== Summary ===');
    console.log(`Items scanned: ${result.rows.length}`);
    console.log(`Items updated: ${itemsUpdated}`);
    console.log(`Image attachments scanned: ${totalAttachments}`);
    console.log(`Corrupted attachments ${dryRun ? 'identified' : 'removed'}: ${totalCorrupted}`);
    if (dryRun) {
        console.log('\nRun again with --execute to apply changes.');
    }
}
function parseArgs() {
    const args = process.argv.slice(2);
    const dryRun = !args.includes('--execute');
    const aggressive = args.includes('--aggressive');
    const ownerFlagIndex = args.findIndex((arg) => arg === '--owner');
    const ownerId = ownerFlagIndex >= 0 ? args[ownerFlagIndex + 1] : undefined;
    if (ownerFlagIndex >= 0 && !ownerId) {
        console.error('Error: --owner flag provided without a user ID');
        process.exit(1);
    }
    return { dryRun, ownerId, aggressive };
}
async function main() {
    try {
        const options = parseArgs();
        await removeCorruptedImages(options);
    }
    catch (error) {
        console.error('Error removing corrupted images:', error);
        process.exitCode = 1;
    }
    finally {
        await pool.end();
    }
}
main();
//# sourceMappingURL=removeCorruptedImages.js.map