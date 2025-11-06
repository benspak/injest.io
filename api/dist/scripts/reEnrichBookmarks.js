import dotenv from 'dotenv';
import pool from '../config/database.js';
import { ItemModel } from '../models/Item.js';
import { linkMetadataService } from '../services/linkMetadata.js';
import { indexingService } from '../services/indexing.js';
dotenv.config();
/**
 * Script to re-enrich all bookmarks for a specific user or all users
 *
 * Usage:
 *   tsx src/scripts/reEnrichBookmarks.ts <userId> [--force]
 *   tsx src/scripts/reEnrichBookmarks.ts --all [--force]
 *
 * Options:
 *   --force: Re-enrich even if metadata already exists
 *   --all: Re-enrich for all users
 */
async function reEnrichBookmarks(userId, force = false, allUsers = false) {
    try {
        console.log('Starting bookmark re-enrichment...');
        console.log(`Mode: ${allUsers ? 'All users' : userId ? `User ${userId}` : 'No user specified'}`);
        console.log(`Force: ${force}`);
        let userIds = [];
        if (allUsers) {
            // Get all user IDs
            const result = await pool.query('SELECT id FROM users');
            userIds = result.rows.map(row => row.id);
            console.log(`Found ${userIds.length} users`);
        }
        else if (userId) {
            userIds = [userId];
        }
        else {
            console.error('Error: Please provide a userId or use --all flag');
            console.log('Usage: tsx src/scripts/reEnrichBookmarks.ts <userId> [--force]');
            console.log('   or: tsx src/scripts/reEnrichBookmarks.ts --all [--force]');
            process.exit(1);
        }
        for (const currentUserId of userIds) {
            console.log(`\nProcessing bookmarks for user ${currentUserId}...`);
            // Get all bookmark items for this user
            const bookmarks = await ItemModel.findByOwner(currentUserId, 10000, 0);
            const bookmarkItems = bookmarks.filter(item => item.source === 'bookmark' && item.url);
            if (bookmarkItems.length === 0) {
                console.log(`No bookmarks found for user ${currentUserId}`);
                continue;
            }
            console.log(`Found ${bookmarkItems.length} bookmarks to process`);
            const results = {
                enriched: 0,
                failed: 0,
                skipped: 0,
                errors: [],
            };
            for (let i = 0; i < bookmarkItems.length; i++) {
                const item = bookmarkItems[i];
                try {
                    // Check if metadata already exists and is complete BEFORE making any API calls
                    // We consider metadata complete if it has a meaningful title (not just the URL) AND (description or image)
                    const existingMetadata = item.link_metadata;
                    const hasTitle = existingMetadata?.title && existingMetadata.title !== item.url && existingMetadata.title.length > 0;
                    const hasDescription = existingMetadata?.description && existingMetadata.description.length > 0;
                    const hasImage = existingMetadata?.image && existingMetadata.image.length > 0;
                    const hasCompleteMetadata = hasTitle && (hasDescription || hasImage);
                    // Skip if metadata is already complete (unless force flag is set)
                    // This prevents unnecessary API calls and retries
                    if (hasCompleteMetadata && !force) {
                        results.skipped++;
                        if (i < 10)
                            console.log(`  Skipping ${item.url} - already has complete metadata (saved in DB)`);
                        continue;
                    }
                    // Fetch metadata
                    console.log(`  [${i + 1}/${bookmarkItems.length}] Fetching metadata for ${item.url}...`);
                    const fetchedMetadata = await linkMetadataService.fetchMetadata(item.url, 3, 30000);
                    // Only update if we got meaningful metadata
                    if (fetchedMetadata && (fetchedMetadata.title || fetchedMetadata.description || fetchedMetadata.image)) {
                        await ItemModel.update(item.id, { link_metadata: fetchedMetadata });
                        // Also update title/description if they're missing or using URL
                        const updates = {};
                        if (!item.title || item.title === item.url) {
                            updates.title = fetchedMetadata.title || item.title;
                        }
                        if (!item.description && fetchedMetadata.description) {
                            updates.description = fetchedMetadata.description;
                        }
                        if (Object.keys(updates).length > 0) {
                            await ItemModel.update(item.id, updates);
                        }
                        // Re-index item to include metadata in search
                        indexingService.indexItem(item.id).catch((indexError) => {
                            console.error(`    Warning: Background re-indexing failed for item ${item.id}:`, indexError);
                        });
                        results.enriched++;
                        console.log(`    ✓ Enriched: ${fetchedMetadata.title || item.url}`);
                        if (i < 10) {
                            console.log(`      - Title: ${fetchedMetadata.title ? 'Yes' : 'No'}`);
                            console.log(`      - Description: ${fetchedMetadata.description ? 'Yes' : 'No'}`);
                            console.log(`      - Image: ${fetchedMetadata.image ? 'Yes' : 'No'}`);
                        }
                    }
                    else {
                        results.skipped++;
                        console.log(`    ⊘ No metadata found for ${item.url}`);
                    }
                    // Log progress every 50 items
                    if (results.enriched % 50 === 0 && results.enriched > 0) {
                        console.log(`\n  Progress: ${results.enriched} enriched, ${results.failed} failed, ${results.skipped} skipped out of ${i + 1} processed\n`);
                    }
                    // Small delay to avoid overwhelming external servers
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                catch (error) {
                    results.failed++;
                    results.errors.push(`${item.url}: ${error.message}`);
                    console.error(`    ✗ Error enriching ${item.url}: ${error.message}`);
                }
            }
            console.log(`\nCompleted for user ${currentUserId}:`);
            console.log(`  - Enriched: ${results.enriched}`);
            console.log(`  - Failed: ${results.failed}`);
            console.log(`  - Skipped: ${results.skipped}`);
            console.log(`  - Total: ${bookmarkItems.length}`);
            if (results.errors.length > 0) {
                console.log(`\nErrors (first 10):`);
                results.errors.slice(0, 10).forEach(error => console.log(`  - ${error}`));
            }
        }
        console.log('\n✓ Re-enrichment completed successfully!');
        process.exit(0);
    }
    catch (error) {
        console.error('Error during re-enrichment:', error);
        process.exit(1);
    }
}
// Parse command line arguments
const args = process.argv.slice(2);
const force = args.includes('--force');
const allUsers = args.includes('--all');
const userId = args.find(arg => !arg.startsWith('--'));
reEnrichBookmarks(userId, force, allUsers);
//# sourceMappingURL=reEnrichBookmarks.js.map