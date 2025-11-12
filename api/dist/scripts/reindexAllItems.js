import dotenv from 'dotenv';
import pool from '../config/database.js';
import { indexingService } from '../services/indexing.js';
import { ContactModel } from '../models/Contact.js';
dotenv.config();
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_CONCURRENCY = 3;
function resolveBatchSize() {
    const value = Number.parseInt(process.env.REINDEX_BATCH_SIZE ?? '', 10);
    if (Number.isNaN(value) || value <= 0) {
        return DEFAULT_BATCH_SIZE;
    }
    return value;
}
function resolveConcurrency() {
    const value = Number.parseInt(process.env.REINDEX_CONCURRENCY ?? '', 10);
    if (Number.isNaN(value) || value <= 0) {
        return DEFAULT_CONCURRENCY;
    }
    return value;
}
function toIsoTimestamp(value) {
    if (value instanceof Date) {
        return value.toISOString();
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
    }
    return value;
}
async function fetchNextBatch(cursor, batchSize) {
    const baseQuery = `
    SELECT id, created_at
    FROM items
    WHERE deleted_at IS NULL
    ORDER BY created_at, id
    LIMIT $1
  `;
    const pagedQuery = `
    SELECT id, created_at
    FROM items
    WHERE deleted_at IS NULL
      AND (
        created_at > $1::timestamptz
        OR (created_at = $1::timestamptz AND id > $2::uuid)
      )
    ORDER BY created_at, id
    LIMIT $3
  `;
    const queryConfig = cursor
        ? { text: pagedQuery, values: [cursor.createdAt, cursor.id, batchSize] }
        : { text: baseQuery, values: [batchSize] };
    const result = await pool.query(queryConfig);
    if (!result.rowCount) {
        return { ids: [], nextCursor: null };
    }
    const rows = result.rows;
    const ids = rows.map((row) => row.id);
    const lastRow = rows[rows.length - 1];
    const nextCursor = {
        id: lastRow.id,
        createdAt: toIsoTimestamp(lastRow.created_at),
    };
    return { ids, nextCursor };
}
async function processItemBatch(ids, concurrency) {
    let success = 0;
    let skipped = 0;
    const failures = [];
    let index = 0;
    const worker = async () => {
        while (true) {
            const currentIndex = index;
            index += 1;
            if (currentIndex >= ids.length) {
                break;
            }
            const itemId = ids[currentIndex];
            try {
                const indexed = await indexingService.indexItem(itemId, { retries: 5 });
                if (indexed) {
                    success += 1;
                }
                else {
                    skipped += 1;
                }
            }
            catch (error) {
                const message = error instanceof Error
                    ? error.message
                    : typeof error === 'string'
                        ? error
                        : JSON.stringify(error);
                console.error(`[Reindex] Failed to index item ${itemId}: ${message}`);
                failures.push({
                    itemId,
                    error: message,
                });
            }
        }
    };
    const workerCount = Math.min(concurrency, ids.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return { success, skipped, failures };
}
async function fetchNextContactBatch(cursor, batchSize) {
    const baseQuery = `
    SELECT id, updated_at
    FROM contacts
    ORDER BY updated_at, id
    LIMIT $1
  `;
    const pagedQuery = `
    SELECT id, updated_at
    FROM contacts
    WHERE
      updated_at > $1::timestamptz
      OR (updated_at = $1::timestamptz AND id > $2::uuid)
    ORDER BY updated_at, id
    LIMIT $3
  `;
    const queryConfig = cursor
        ? { text: pagedQuery, values: [cursor.updatedAt, cursor.id, batchSize] }
        : { text: baseQuery, values: [batchSize] };
    const result = await pool.query(queryConfig);
    if (!result.rowCount) {
        return { ids: [], nextCursor: null };
    }
    const rows = result.rows;
    const ids = rows.map((row) => row.id);
    const lastRow = rows[rows.length - 1];
    const nextCursor = {
        id: lastRow.id,
        updatedAt: toIsoTimestamp(lastRow.updated_at),
    };
    return { ids, nextCursor };
}
async function processContactBatch(ids, concurrency) {
    let success = 0;
    let skipped = 0;
    const failures = [];
    let index = 0;
    const worker = async () => {
        while (true) {
            const currentIndex = index;
            index += 1;
            if (currentIndex >= ids.length) {
                break;
            }
            const contactId = ids[currentIndex];
            try {
                const contact = await ContactModel.findById(contactId);
                if (!contact) {
                    console.warn(`[Reindex] Contact ${contactId} not found; skipping.`);
                    skipped += 1;
                    continue;
                }
                const indexed = await indexingService.indexContact(contact);
                if (indexed) {
                    success += 1;
                }
                else {
                    skipped += 1;
                }
            }
            catch (error) {
                const message = error instanceof Error
                    ? error.message
                    : typeof error === 'string'
                        ? error
                        : JSON.stringify(error);
                console.error(`[Reindex] Failed to index contact ${contactId}: ${message}`);
                failures.push({
                    itemId: contactId,
                    error: message,
                });
            }
        }
    };
    const workerCount = Math.min(concurrency, ids.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return { success, skipped, failures };
}
async function main() {
    const batchSize = resolveBatchSize();
    const concurrency = resolveConcurrency();
    const startedAt = Date.now();
    console.log('[Reindex] Starting full reindex job', {
        batchSize,
        concurrency,
        startedAt: new Date(startedAt).toISOString(),
    });
    let cursor = null;
    let batchNumber = 0;
    let processed = 0;
    let totalSuccess = 0;
    let totalSkipped = 0;
    const allFailures = [];
    try {
        while (true) {
            const { ids, nextCursor } = await fetchNextBatch(cursor, batchSize);
            if (ids.length === 0) {
                break;
            }
            batchNumber += 1;
            console.log(`[Reindex] Processing item batch ${batchNumber} (${ids.length} items)...`);
            const batchResult = await processItemBatch(ids, concurrency);
            processed += ids.length;
            totalSuccess += batchResult.success;
            totalSkipped += batchResult.skipped;
            allFailures.push(...batchResult.failures);
            console.log(`[Reindex] Batch ${batchNumber} complete: ${batchResult.success} indexed, ${batchResult.skipped} skipped, ${batchResult.failures.length} failures.`);
            cursor = nextCursor;
        }
        const itemDurationMs = Date.now() - startedAt;
        console.log('[Reindex] Item reindex complete', {
            processed,
            indexed: totalSuccess,
            skipped: totalSkipped,
            failures: allFailures.length,
            durationMs: itemDurationMs,
            durationSeconds: Math.round(itemDurationMs / 1000),
        });
        if (allFailures.length > 0) {
            console.warn('[Reindex] Some items failed to reindex. Summary:', allFailures.slice(0, 10));
        }
        // Reindex contacts
        console.log('[Reindex] Starting contact reindex job');
        let contactCursor = null;
        let contactBatchNumber = 0;
        let contactsProcessed = 0;
        let contactSuccess = 0;
        let contactSkipped = 0;
        const contactFailures = [];
        while (true) {
            const { ids, nextCursor } = await fetchNextContactBatch(contactCursor, batchSize);
            if (ids.length === 0) {
                break;
            }
            contactBatchNumber += 1;
            console.log(`[Reindex] Processing contact batch ${contactBatchNumber} (${ids.length} contacts)...`);
            const batchResult = await processContactBatch(ids, concurrency);
            contactsProcessed += ids.length;
            contactSuccess += batchResult.success;
            contactSkipped += batchResult.skipped;
            contactFailures.push(...batchResult.failures);
            console.log(`[Reindex] Contact batch ${contactBatchNumber} complete: ${batchResult.success} indexed, ${batchResult.skipped} skipped, ${batchResult.failures.length} failures.`);
            contactCursor = nextCursor;
        }
        const contactDurationMs = Date.now() - startedAt;
        console.log('[Reindex] Contact reindex complete', {
            processed: contactsProcessed,
            indexed: contactSuccess,
            skipped: contactSkipped,
            failures: contactFailures.length,
            durationMs: contactDurationMs,
            durationSeconds: Math.round(contactDurationMs / 1000),
        });
        if (contactFailures.length > 0) {
            console.warn('[Reindex] Some contacts failed to reindex. Summary:', contactFailures.slice(0, 10));
        }
    }
    catch (error) {
        console.error('[Reindex] Job failed:', error);
        process.exitCode = 1;
    }
    finally {
        await pool.end().catch((poolError) => {
            console.error('[Reindex] Failed to close database pool:', poolError);
        });
    }
}
void main();
//# sourceMappingURL=reindexAllItems.js.map