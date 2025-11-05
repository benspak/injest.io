import pool from '../config/database.js';
export class EmbeddingModel {
    static async create(itemId, embedding) {
        // Convert array to pgvector format
        const result = await pool.query('INSERT INTO embeddings (item_id, embedding) VALUES ($1, $2::vector) RETURNING *', [itemId, `[${embedding.join(',')}]`]);
        return result.rows[0];
    }
    static async findByItemId(itemId) {
        const result = await pool.query('SELECT * FROM embeddings WHERE item_id = $1', [itemId]);
        return result.rows[0] || null;
    }
    static async findSimilar(queryEmbedding, limit = 10) {
        const embeddingStr = `[${queryEmbedding.join(',')}]`;
        const result = await pool.query(`SELECT *, 1 - (embedding <=> $1::vector) as similarity
       FROM embeddings
       ORDER BY embedding <=> $1::vector
       LIMIT $2`, [embeddingStr, limit]);
        return result.rows;
    }
    static async deleteByItemId(itemId) {
        const result = await pool.query('DELETE FROM embeddings WHERE item_id = $1', [itemId]);
        return result.rowCount !== null && result.rowCount > 0;
    }
}
//# sourceMappingURL=Embedding.js.map