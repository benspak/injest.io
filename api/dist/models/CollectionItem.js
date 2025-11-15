import pool from '../config/database.js';
export class CollectionItemModel {
    static async addItem(collectionId, itemId, client) {
        const executor = client ?? pool;
        const result = await executor.query(`INSERT INTO collection_items (collection_id, item_id)
       VALUES ($1, $2)
       ON CONFLICT (collection_id, item_id) DO NOTHING
       RETURNING *`, [collectionId, itemId]);
        if (result.rows.length === 0) {
            // Item already exists, fetch it
            const existing = await executor.query('SELECT * FROM collection_items WHERE collection_id = $1 AND item_id = $2', [collectionId, itemId]);
            return existing.rows[0];
        }
        return result.rows[0];
    }
    static async removeItem(collectionId, itemId, client) {
        const executor = client ?? pool;
        const result = await executor.query('DELETE FROM collection_items WHERE collection_id = $1 AND item_id = $2 RETURNING *', [collectionId, itemId]);
        return (result.rowCount ?? 0) > 0;
    }
    static async findByCollection(collectionId, limit = 100, offset = 0) {
        const result = await pool.query(`SELECT i.*
       FROM items i
       INNER JOIN collection_items ci ON i.id = ci.item_id
       WHERE ci.collection_id = $1
         AND i.deleted_at IS NULL
       ORDER BY ci.created_at DESC
       LIMIT $2 OFFSET $3`, [collectionId, limit, offset]);
        return result.rows;
    }
    static async countByCollection(collectionId) {
        const result = await pool.query(`SELECT COUNT(*) as total
       FROM collection_items ci
       INNER JOIN items i ON ci.item_id = i.id
       WHERE ci.collection_id = $1
         AND i.deleted_at IS NULL`, [collectionId]);
        return parseInt(result.rows[0]?.total ?? '0', 10);
    }
    static async findByItem(itemId) {
        const result = await pool.query(`SELECT c.*
       FROM collections c
       INNER JOIN collection_items ci ON c.id = ci.collection_id
       WHERE ci.item_id = $1
       ORDER BY ci.created_at DESC`, [itemId]);
        return result.rows;
    }
    static async isItemInCollection(collectionId, itemId) {
        const result = await pool.query(`SELECT 1 FROM collection_items
       WHERE collection_id = $1 AND item_id = $2
       LIMIT 1`, [collectionId, itemId]);
        return (result.rowCount ?? 0) > 0;
    }
    static async addItems(collectionId, itemIds, client) {
        const executor = client ?? pool;
        if (itemIds.length === 0) {
            return 0;
        }
        // Use a transaction to ensure all-or-nothing
        const clientToUse = client ?? await pool.connect();
        let addedCount = 0;
        try {
            if (!client) {
                await clientToUse.query('BEGIN');
            }
            for (const itemId of itemIds) {
                const result = await clientToUse.query(`INSERT INTO collection_items (collection_id, item_id)
           VALUES ($1, $2)
           ON CONFLICT (collection_id, item_id) DO NOTHING`, [collectionId, itemId]);
                if ((result.rowCount ?? 0) > 0) {
                    addedCount++;
                }
            }
            if (!client) {
                await clientToUse.query('COMMIT');
            }
        }
        catch (error) {
            if (!client) {
                await clientToUse.query('ROLLBACK');
            }
            throw error;
        }
        finally {
            if (!client) {
                clientToUse.release();
            }
        }
        return addedCount;
    }
}
//# sourceMappingURL=CollectionItem.js.map