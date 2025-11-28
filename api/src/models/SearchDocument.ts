import pool from '../config/database.js';
import { encryptField, decryptField } from '../utils/encryption.js';

export type SearchEntityType = 'item' | 'contact' | 'user';

export interface SearchDocument {
  id: string;
  owner_id: string;
  entity_type: SearchEntityType;
  entity_id: string;
  title: string | null;
  content: string | null;
  summary: string | null;
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

export interface UpsertSearchDocumentInput {
  ownerId: string;
  entityType: SearchEntityType;
  entityId: string;
  title?: string | null;
  content?: string | null;
  summary?: string | null;
  tags?: string[] | null;
  metadata?: Record<string, unknown> | null;
}

export class SearchDocumentModel {
  /**
   * Decrypt encrypted fields from database result
   * Handles both encrypted and unencrypted data (for migration compatibility)
   */
  private static decryptDocument(doc: any): SearchDocument {
    if (!doc) {
      return doc;
    }
    return {
      ...doc,
      title: decryptField(doc.title),
      content: decryptField(doc.content),
      summary: decryptField(doc.summary),
    };
  }

  static async upsert(input: UpsertSearchDocumentInput): Promise<SearchDocument> {
    // Encrypt sensitive content fields before storing
    const encryptedTitle = encryptField(input.title); // Non-deterministic encryption (can be decrypted for display)
    const encryptedContent = encryptField(input.content); // Opaque encryption
    const encryptedSummary = encryptField(input.summary); // Opaque encryption

    const result = await pool.query<SearchDocument>(
      `
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
      `,
      [
        input.ownerId,
        input.entityType,
        input.entityId,
        encryptedTitle,
        encryptedContent,
        encryptedSummary,
        input.tags ?? null,
        input.metadata ?? null,
      ]
    );

    return this.decryptDocument(result.rows[0]!);
  }

  static async findByEntity(entityType: SearchEntityType, entityId: string): Promise<SearchDocument | null> {
    const result = await pool.query<SearchDocument>(
      `
        SELECT *
        FROM search_documents
        WHERE entity_type = $1 AND entity_id = $2
        LIMIT 1
      `,
      [entityType, entityId]
    );
    return this.decryptDocument(result.rows[0] ?? null);
  }

  static async deleteByEntity(entityType: SearchEntityType, entityId: string): Promise<void> {
    await pool.query(
      `
        DELETE FROM search_documents
        WHERE entity_type = $1 AND entity_id = $2
      `,
      [entityType, entityId]
    );
  }
}
