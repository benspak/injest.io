import pool from '../config/database.js';
import type { Item } from './Item.js';
import type { Contact } from './Contact.js';
import type { User } from './User.js';
import { itemAccessEmailNormalizer } from './ItemAccess.js';
import type { SearchFilters } from '../types/search.js';
import type { SearchEntityType } from './SearchDocument.js';

export interface SemanticSimilarityResult {
  documentId: string;
  entityType: SearchEntityType;
  document: {
    title: string | null;
    summary: string | null;
    content: string | null;
    tags: string[] | null;
    metadata: Record<string, unknown> | null;
  };
  item?: Item;
  contact?: Contact;
  user?: User;
  vectorScore: number;
  recencyScore: number;
  tagBoost: number;
  titleBoost: number;
  ownerBoost: number;
  overallScore: number;
}

export interface Embedding {
  id: string;
  document_id: string;
  embedding: number[];
  created_at: Date;
}

const sanitizeStringArray = (values?: string[] | null): string[] | null => {
  if (!Array.isArray(values)) {
    return null;
  }
  const normalized = values
    .map((value) => value?.toString().trim())
    .filter((value): value is string => Boolean(value));
  return normalized.length > 0 ? normalized : null;
};

const parsedDate = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export class EmbeddingModel {
  static async create(documentId: string, embedding: number[]): Promise<Embedding> {
    const result = await pool.query<Embedding>(
      `
        INSERT INTO search_embeddings (document_id, embedding)
        VALUES ($1, $2::vector)
        ON CONFLICT (document_id)
        DO UPDATE SET
          embedding = EXCLUDED.embedding,
          created_at = CURRENT_TIMESTAMP
        RETURNING *
      `,
      [documentId, `[${embedding.join(',')}]`]
    );

    return result.rows[0]!;
  }

  static async deleteByDocumentId(documentId: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM search_embeddings WHERE document_id = $1',
      [documentId]
    );
    return Boolean(result.rowCount && result.rowCount > 0);
  }

  static async findSimilar(
    queryEmbedding: number[],
    options: {
      userId: string;
      email?: string | null;
      limit?: number;
      candidateMultiplier?: number;
      titlePatterns?: string[];
      filters?: SearchFilters;
    }
  ): Promise<SemanticSimilarityResult[]> {
    const {
      userId,
      email,
      limit = 10,
      candidateMultiplier = 4,
      titlePatterns = [],
      filters = {},
    } = options;

    if (!userId) {
      throw new Error('userId is required to search embeddings');
    }

    const normalizedEmail = email ? itemAccessEmailNormalizer(email) : null;
    const candidateLimit = Math.max(limit * candidateMultiplier, limit);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    const entitiesFilter = sanitizeStringArray(filters.entities);
    const typesFilter = sanitizeStringArray(filters.types);
    const tagsFilter = sanitizeStringArray(filters.tags);
    const sourcesFilter = sanitizeStringArray(filters.sources);
    const dateFrom = parsedDate(filters.dateFrom);
    const dateTo = parsedDate(filters.dateTo);
    const hasAttachments =
      typeof filters.hasAttachments === 'boolean' ? filters.hasAttachments : null;
    const uploadedBy =
      filters.uploadedBy && ['me', 'shared'].includes(filters.uploadedBy)
        ? filters.uploadedBy
        : null;
    const fileType = filters.fileType ?? null;

    const result = await pool.query<any>(
      `
        WITH query_embedding AS (
          SELECT $1::vector AS embedding
        ),
        ranked_candidates AS (
          SELECT
            sd.id AS document_id,
            sd.entity_type,
            sd.owner_id,
            sd.title AS document_title,
            sd.summary AS document_summary,
            sd.content AS document_content,
            sd.tags AS document_tags,
            sd.metadata AS document_metadata,
            row_to_json(i) AS item_json,
            row_to_json(c) AS contact_json,
            row_to_json(u) AS user_json,
            1 - (se.embedding <=> qe.embedding) AS vector_score,
            EXP(
              -GREATEST(
                EXTRACT(
                  EPOCH FROM (
                    NOW() - COALESCE(
                      i.created_at,
                      c.updated_at,
                      u.updated_at,
                      sd.updated_at,
                      sd.created_at
                    )
                  )
                ) / 86400.0,
                0
              ) / 30.0
            ) AS recency_score,
            CASE
              WHEN sd.tags IS NOT NULL AND array_length(sd.tags, 1) > 0 THEN 0.05
              ELSE 0.0
            END AS tag_boost,
            CASE
              WHEN array_length($5::text[], 1) > 0
                AND sd.title IS NOT NULL
                AND EXISTS (
                  SELECT 1
                  FROM unnest($5::text[]) pattern
                  WHERE LOWER(sd.title) LIKE pattern
                )
              THEN 0.05
              ELSE 0.0
            END AS title_boost,
            CASE
              WHEN sd.owner_id = $2 THEN 0.05
              ELSE 0.0
            END AS owner_boost
          FROM search_embeddings se
          JOIN search_documents sd ON sd.id = se.document_id
          JOIN query_embedding qe ON TRUE
          LEFT JOIN items i ON sd.entity_type = 'item' AND sd.entity_id = i.id
          LEFT JOIN contacts c ON sd.entity_type = 'contact' AND sd.entity_id = c.id
          LEFT JOIN users u ON sd.entity_type = 'user' AND sd.entity_id = u.id
          WHERE (
            sd.entity_type <> 'item'
            OR (i.deleted_at IS NULL OR i.deleted_at > NOW())
          )
          AND (
            sd.owner_id = $2
            OR (
              sd.entity_type = 'item'
              AND EXISTS (
                SELECT 1
                FROM item_access ia
                WHERE ia.item_id = sd.entity_id
                  AND (
                    ia.user_id = $2
                    OR (($3)::text IS NOT NULL AND ia.normalized_email = $3::text)
                  )
              )
            )
            OR (
              sd.entity_type = 'user'
              AND sd.owner_id = $2
            )
          )
          AND (
            $4::text[] IS NULL
            OR sd.entity_type = ANY($4::text[])
          )
          AND (
            $6::text[] IS NULL
            OR (
              sd.entity_type = 'item'
              AND i.type = ANY($6::text[])
            )
          )
          AND (
            $7::text[] IS NULL
            OR (
              sd.tags IS NOT NULL
              AND sd.tags && $7::text[]
            )
          )
          AND (
            $8::timestamptz IS NULL
            OR COALESCE(i.created_at, c.updated_at, u.updated_at, sd.updated_at, sd.created_at) >= $8::timestamptz
          )
          AND (
            $9::timestamptz IS NULL
            OR COALESCE(i.created_at, c.updated_at, u.updated_at, sd.updated_at, sd.created_at) <= $9::timestamptz
          )
          AND (
            $10::boolean IS NULL
            OR (
              $10 = TRUE
              AND sd.entity_type = 'item'
              AND i.attachments IS NOT NULL
              AND jsonb_array_length(i.attachments) > 0
            )
          )
          AND (
            $11::text[] IS NULL
            OR (
              sd.entity_type = 'item'
              AND i.source = ANY($11::text[])
            )
          )
          AND (
            $12::text IS NULL
            OR (
              sd.entity_type = 'item'
              AND (
                ($12 = 'me' AND i.owner_id = $2)
                OR ($12 = 'shared' AND i.owner_id <> $2)
              )
            )
          )
          AND (
            $13::text IS NULL
            OR (
              sd.entity_type = 'item'
              AND i.attachments IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM jsonb_array_elements(i.attachments) AS attachment
                WHERE CASE
                  WHEN $13 = 'image' THEN (attachment->>'mimetype')::text LIKE 'image/%'
                  WHEN $13 = 'spreadsheet' THEN (attachment->>'mimetype')::text IN (
                    'application/vnd.ms-excel',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.oasis.opendocument.spreadsheet',
                    'text/csv',
                    'application/csv'
                  )
                  WHEN $13 = 'document' THEN (attachment->>'mimetype')::text IN (
                    'application/pdf',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/vnd.oasis.opendocument.text',
                    'text/plain',
                    'text/rtf'
                  )
                  ELSE FALSE
                END
              )
            )
          )
          ORDER BY se.embedding <=> qe.embedding
          LIMIT $14
        )
        SELECT
          document_id,
          entity_type,
          document_title,
          document_summary,
          document_content,
          document_tags,
          document_metadata,
          item_json,
          contact_json,
          user_json,
          vector_score,
          recency_score,
          tag_boost,
          title_boost,
          owner_boost,
          (vector_score * 0.75)
          + (recency_score * 0.15)
          + tag_boost
          + title_boost
          + owner_boost AS overall_score
        FROM ranked_candidates
        ORDER BY overall_score DESC
        LIMIT $15
      `,
      [
        embeddingStr,
        userId,
        normalizedEmail,
        entitiesFilter,
        titlePatterns,
        typesFilter,
        tagsFilter,
        dateFrom,
        dateTo,
        hasAttachments,
        sourcesFilter,
        uploadedBy,
        fileType,
        candidateLimit,
        limit,
      ]
    );

    return result.rows.map((row) => {
      const {
        document_id,
        entity_type,
        document_title,
        document_summary,
        document_content,
        document_tags,
        document_metadata,
        item_json,
        contact_json,
        user_json,
        vector_score,
        recency_score,
        tag_boost,
        title_boost,
        owner_boost,
        overall_score,
      } = row;

      return {
        documentId: document_id,
        entityType: entity_type as SearchEntityType,
        document: {
          title: document_title ?? null,
          summary: document_summary ?? null,
          content: document_content ?? null,
          tags: document_tags ?? null,
          metadata:
            document_metadata && typeof document_metadata === 'object'
              ? (document_metadata as Record<string, unknown>)
              : {},
        },
        item:
          item_json && typeof item_json === 'object'
            ? (item_json as Item)
            : undefined,
        contact:
          contact_json && typeof contact_json === 'object'
            ? (contact_json as Contact)
            : undefined,
        user:
          user_json && typeof user_json === 'object'
            ? (user_json as User)
            : undefined,
        vectorScore: typeof vector_score === 'number' ? vector_score : parseFloat(vector_score),
        recencyScore:
          typeof recency_score === 'number' ? recency_score : parseFloat(recency_score),
        tagBoost: typeof tag_boost === 'number' ? tag_boost : parseFloat(tag_boost),
        titleBoost: typeof title_boost === 'number' ? title_boost : parseFloat(title_boost),
        ownerBoost: typeof owner_boost === 'number' ? owner_boost : parseFloat(owner_boost),
        overallScore:
          typeof overall_score === 'number' ? overall_score : parseFloat(overall_score),
      };
    });
  }
}
