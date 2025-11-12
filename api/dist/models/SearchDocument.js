import pool from '../config/database.js';
export class SearchDocumentModel {
    static async upsert(input) {
        const result = await pool.query(`
        INSERT INTO search_documents (
          owner_id,
          entity_type,
          entity_id,
          title,
          content,
          summary,
          tags,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (entity_type, entity_id)
        DO UPDATE SET
          owner_id = EXCLUDED.owner_id,
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          summary = EXCLUDED.summary,
          tags = EXCLUDED.tags,
          metadata = jsonb_strip_nulls(COALESCE(search_documents.metadata, '{}'::jsonb) || COALESCE(EXCLUDED.metadata, '{}'::jsonb)),
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [
            input.ownerId,
            input.entityType,
            input.entityId,
            input.title ?? null,
            input.content ?? null,
            input.summary ?? null,
            input.tags ?? null,
            input.metadata ?? null,
        ]);
        return result.rows[0];
    }
    static async findByEntity(entityType, entityId) {
        const result = await pool.query(`
        SELECT *
        FROM search_documents
        WHERE entity_type = $1 AND entity_id = $2
        LIMIT 1
      `, [entityType, entityId]);
        return result.rows[0] ?? null;
    }
    static async deleteByEntity(entityType, entityId) {
        await pool.query(`
        DELETE FROM search_documents
        WHERE entity_type = $1 AND entity_id = $2
      `, [entityType, entityId]);
    }
}
//# sourceMappingURL=SearchDocument.js.map