import dotenv from 'dotenv';
import pool from '../config/database.js';
dotenv.config();
async function backfillProviderIds(client) {
    const batchSize = 200;
    let processed = 0;
    let updated = 0;
    let skipped = 0;
    for (;;) {
        const { rows } = await client.query(`
        SELECT id, raw
        FROM items
        WHERE type = 'email'
          AND raw IS NOT NULL
          AND (raw::jsonb ? 'resend_email_id')
          AND NOT (raw::jsonb ? 'provider_email_id')
        ORDER BY created_at ASC
        LIMIT $1
      `, [batchSize]);
        if (rows.length === 0) {
            break;
        }
        for (const row of rows) {
            processed += 1;
            if (!row.raw) {
                skipped += 1;
                continue;
            }
            try {
                const parsed = JSON.parse(row.raw);
                const resendId = typeof parsed.resend_email_id === 'string' ? parsed.resend_email_id : null;
                const providerId = typeof parsed.provider_email_id === 'string' ? parsed.provider_email_id : null;
                if (!resendId || providerId) {
                    skipped += 1;
                    continue;
                }
                parsed.provider_email_id = resendId;
                await client.query('UPDATE items SET raw = $1 WHERE id = $2', [JSON.stringify(parsed), row.id]);
                updated += 1;
            }
            catch (error) {
                console.warn('[AutoSend Migration] Failed to parse raw payload for item', {
                    id: row.id,
                    error,
                });
                skipped += 1;
            }
        }
    }
    return { processed, updated, skipped };
}
async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const results = await backfillProviderIds(client);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_items_provider_email_id_deleted
        ON items((raw::jsonb->>'provider_email_id'), deleted_at)
    `);
        await client.query('COMMIT');
        console.log('[AutoSend Migration] Completed provider ID backfill', results);
    }
    catch (error) {
        await client.query('ROLLBACK').catch((rollbackError) => {
            console.error('[AutoSend Migration] Failed to rollback transaction', rollbackError);
        });
        console.error('[AutoSend Migration] Migration failed', error);
        throw error;
    }
    finally {
        client.release();
        await pool.end().catch((closeError) => {
            console.error('[AutoSend Migration] Failed to close pool', closeError);
        });
    }
}
migrate()
    .then(() => {
    console.log('[AutoSend Migration] Done');
    process.exit(0);
})
    .catch((error) => {
    console.error('[AutoSend Migration] Error', error);
    process.exit(1);
});
//# sourceMappingURL=migrateEmailProviderIds.js.map