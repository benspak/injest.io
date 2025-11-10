import dotenv from 'dotenv';

import pool from '../config/database.js';
import { indexingService } from '../services/indexing.js';

dotenv.config();

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_CONCURRENCY = 2;

interface Cursor {
  createdAt: string;
  id: string;
}

interface FailureRecord {
  itemId: string;
  error: string;
}

interface BatchResult {
  success: number;
  skipped: number;
  failures: FailureRecord[];
}

function resolveBatchSize(): number {
  const value = Number.parseInt(process.env.REINDEX_BATCH_SIZE ?? '', 10);
  if (Number.isNaN(value) || value <= 0) {
    return DEFAULT_BATCH_SIZE;
  }
  return value;
}

function resolveConcurrency(): number {
  const value = Number.parseInt(process.env.REINDEX_CONCURRENCY ?? '', 10);
  if (Number.isNaN(value) || value <= 0) {
    return DEFAULT_CONCURRENCY;
  }
  return value;
}

function toIsoTimestamp(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return value;
}

async function fetchNextBatch(cursor: Cursor | null, batchSize: number): Promise<{ ids: string[]; nextCursor: Cursor | null }> {
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

  const rows = result.rows as { id: string; created_at: string | Date }[];
  const ids = rows.map((row) => row.id);

  const lastRow = rows[rows.length - 1];
  const nextCursor: Cursor = {
    id: lastRow.id,
    createdAt: toIsoTimestamp(lastRow.created_at),
  };

  return { ids, nextCursor };
}

async function processBatch(ids: string[], concurrency: number): Promise<BatchResult> {
  let success = 0;
  let skipped = 0;
  const failures: FailureRecord[] = [];

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
        } else {
          skipped += 1;
        }
      } catch (error: unknown) {
        const message =
          error instanceof Error
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

async function main(): Promise<void> {
  const batchSize = resolveBatchSize();
  const concurrency = resolveConcurrency();
  const startedAt = Date.now();

  console.log('[Reindex] Starting full reindex job', {
    batchSize,
    concurrency,
    startedAt: new Date(startedAt).toISOString(),
  });

  let cursor: Cursor | null = null;
  let batchNumber = 0;
  let processed = 0;
  let totalSuccess = 0;
  let totalSkipped = 0;
  const allFailures: FailureRecord[] = [];

  try {
    while (true) {
      const { ids, nextCursor } = await fetchNextBatch(cursor, batchSize);
      if (ids.length === 0) {
        break;
      }

      batchNumber += 1;
      console.log(`[Reindex] Processing batch ${batchNumber} (${ids.length} items)...`);

      const batchResult = await processBatch(ids, concurrency);

      processed += ids.length;
      totalSuccess += batchResult.success;
      totalSkipped += batchResult.skipped;
      allFailures.push(...batchResult.failures);

      console.log(
        `[Reindex] Batch ${batchNumber} complete: ${batchResult.success} indexed, ${batchResult.skipped} skipped, ${batchResult.failures.length} failures.`
      );

      cursor = nextCursor;
    }

    const durationMs = Date.now() - startedAt;
    console.log('[Reindex] Job complete', {
      processed,
      indexed: totalSuccess,
      skipped: totalSkipped,
      failures: allFailures.length,
      durationMs,
      durationSeconds: Math.round(durationMs / 1000),
    });

    if (allFailures.length > 0) {
      console.warn('[Reindex] Some items failed to reindex. Summary:', allFailures.slice(0, 10));
    }
  } catch (error) {
    console.error('[Reindex] Job failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end().catch((poolError) => {
      console.error('[Reindex] Failed to close database pool:', poolError);
    });
  }
}

void main();
