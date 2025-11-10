import pool from '../config/database.js';
import { itemAccessEmailNormalizer } from './ItemAccess.js';
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
    static async findSimilar(queryEmbedding, options) {
        const { userId, email, limit = 10, candidateMultiplier = 4, titlePatterns = [], filters = {}, } = options;
        if (!userId) {
            throw new Error('userId is required to search embeddings');
        }
        const normalizedEmail = email ? itemAccessEmailNormalizer(email) : null;
        const candidateLimit = Math.max(limit * candidateMultiplier, limit);
        const embeddingStr = `[${queryEmbedding.join(',')}]`;
        const typesFilter = filters.types && filters.types.length > 0 ? filters.types : null;
        const tagsFilter = filters.tags && filters.tags.length > 0 ? filters.tags : null;
        const dateFrom = filters.dateFrom ?? null;
        const dateTo = filters.dateTo ?? null;
        const hasAttachments = typeof filters.hasAttachments === 'boolean' ? filters.hasAttachments : null;
        const sourcesFilter = filters.sources && filters.sources.length > 0 ? filters.sources : null;
        const uploadedBy = filters.uploadedBy && filters.uploadedBy !== 'all' ? filters.uploadedBy : null;
        const result = await pool.query(`
        WITH query_embedding AS (
          SELECT $1::vector AS embedding
        ),
        ranked_candidates AS (
          SELECT
            i.*,
            1 - (e.embedding <=> qe.embedding) AS vector_score,
            EXP(-GREATEST(EXTRACT(EPOCH FROM (NOW() - i.created_at)) / 86400.0, 0) / 30.0) AS recency_score,
            CASE
              WHEN i.tags IS NOT NULL AND array_length(i.tags, 1) > 0 THEN 0.05
              ELSE 0.0
            END AS tag_boost,
            CASE
              WHEN array_length($4::text[], 1) > 0
                AND i.title IS NOT NULL
                AND EXISTS (
                  SELECT 1
                  FROM unnest($4::text[]) pattern
                  WHERE LOWER(i.title) LIKE pattern
                )
              THEN 0.05
              ELSE 0.0
            END AS title_boost,
            CASE
              WHEN i.owner_id = $2 THEN 0.05
              ELSE 0.0
            END AS owner_boost
          FROM embeddings e
          JOIN items i ON i.id = e.item_id
          JOIN query_embedding qe ON TRUE
          WHERE i.deleted_at IS NULL
            AND (
              i.owner_id = $2
              OR EXISTS (
                SELECT 1
                FROM item_access ia
                WHERE ia.item_id = i.id
                  AND (
                    ia.user_id = $2
                    OR (($3)::text IS NOT NULL AND ia.normalized_email = $3::text)
                  )
              )
            )
            AND (
              $7::text[] IS NULL
              OR i.type = ANY($7::text[])
            )
            AND (
              $8::text[] IS NULL
              OR (
                i.tags IS NOT NULL
                AND i.tags && $8::text[]
              )
            )
            AND (
              $9::timestamptz IS NULL
              OR i.created_at >= $9::timestamptz
            )
            AND (
              $10::timestamptz IS NULL
              OR i.created_at <= $10::timestamptz
            )
            AND (
              $11::boolean IS NULL
              OR (
                $11 = TRUE
                AND i.attachments IS NOT NULL
                AND jsonb_array_length(i.attachments) > 0
              )
            )
            AND (
              $12::text[] IS NULL
              OR i.source = ANY($12::text[])
            )
            AND (
              $13::text IS NULL
              OR (
                $13 = 'me' AND i.owner_id = $2
              )
              OR (
                $13 = 'shared' AND i.owner_id <> $2
              )
            )
          ORDER BY e.embedding <=> qe.embedding
          LIMIT $5
        )
        SELECT
          *,
          (vector_score * 0.75)
          + (recency_score * 0.15)
          + tag_boost
          + title_boost
          + owner_boost AS overall_score
        FROM ranked_candidates
        ORDER BY overall_score DESC
        LIMIT $6
      `, [
            embeddingStr,
            userId,
            normalizedEmail,
            titlePatterns,
            candidateLimit,
            limit,
            typesFilter,
            tagsFilter,
            dateFrom,
            dateTo,
            hasAttachments,
            sourcesFilter,
            uploadedBy,
        ]);
        return result.rows.map((row) => {
            const { vector_score, recency_score, tag_boost, title_boost, owner_boost, overall_score, ...item } = row;
            return {
                item: item,
                vectorScore: typeof vector_score === 'number' ? vector_score : parseFloat(vector_score),
                recencyScore: typeof recency_score === 'number' ? recency_score : parseFloat(recency_score),
                tagBoost: typeof tag_boost === 'number' ? tag_boost : parseFloat(tag_boost),
                titleBoost: typeof title_boost === 'number' ? title_boost : parseFloat(title_boost),
                ownerBoost: typeof owner_boost === 'number' ? owner_boost : parseFloat(owner_boost),
                overallScore: typeof overall_score === 'number' ? overall_score : parseFloat(overall_score),
            };
        });
    }
    static async deleteByItemId(itemId) {
        const result = await pool.query('DELETE FROM embeddings WHERE item_id = $1', [itemId]);
        return result.rowCount !== null && result.rowCount > 0;
    }
}
//# sourceMappingURL=Embedding.js.map