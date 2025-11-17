import { embeddingService } from './embeddings.js';
import pool from '../config/database.js';
import type { SearchFilters } from '../types/search.js';
import { itemAccessEmailNormalizer } from '../models/ItemAccess.js';

export interface SearchResultScores {
  overall: number;
  vector: number;
  recency: number;
  tagBoost: number;
  titleBoost: number;
  ownerBoost: number;
}

export interface SearchResultDocument {
  title: string | null;
  summary: string | null;
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
}

export interface SearchResult {
  entityType: 'item' | 'contact' | 'user';
  entityId: string;
  item?: any;
  contact?: any;
  user?: any;
  document?: SearchResultDocument;
  similarity: number;
  scores?: SearchResultScores;
}

const SEARCH_CACHE_TTL_MS = 60_000; // 60 seconds
const SEARCH_CACHE_MAX_ENTRIES = 200;

interface CacheEntry {
  value: SearchResult[];
  expiresAt: number;
  userId: string;
}

const sanitizeArray = (values?: string[] | null, toLower: boolean = true): string[] | null => {
  if (!Array.isArray(values)) {
    return null;
  }
  const normalized = values
    .map((value) => {
      const trimmed = value?.toString().trim();
      if (!trimmed) {
        return null;
      }
      return toLower ? trimmed.toLowerCase() : trimmed;
    })
    .filter((value): value is string => Boolean(value));
  return normalized.length > 0 ? normalized : null;
};

const parseDate = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export class SearchService {
  private cache = new Map<string, CacheEntry>();
  private userCacheKeys = new Map<string, Set<string>>();

  private buildCacheKey(userId: string, query: string, limit: number, filters?: SearchFilters): string {
    const normalizedQuery = query.trim().toLowerCase();
    const filterSignature = this.serializeFilters(filters);
    return `${userId}::${limit}::${normalizedQuery}::${filterSignature}`;
  }

  private serializeFilters(filters?: SearchFilters): string {
    if (!filters) {
      return '';
    }

    const entries: [string, unknown][] = [];

    const pushArray = (name: string, values?: string[]) => {
      if (values && values.length > 0) {
        entries.push([name, [...values].sort()]);
      }
    };

    pushArray('entities', filters.entities as string[] | undefined);
    pushArray('types', filters.types);
    pushArray('tags', filters.tags);
    pushArray('sources', filters.sources);

    if (filters.uploadedBy) {
      entries.push(['uploadedBy', filters.uploadedBy]);
    }
    if (filters.dateFrom) {
      entries.push(['dateFrom', filters.dateFrom]);
    }
    if (filters.dateTo) {
      entries.push(['dateTo', filters.dateTo]);
    }
    if (typeof filters.hasAttachments === 'boolean') {
      entries.push(['hasAttachments', filters.hasAttachments]);
    }
    if (filters.fileType) {
      entries.push(['fileType', filters.fileType]);
    }

    entries.sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify(entries);
  }

  private unlinkCacheKey(userId: string, cacheKey: string): void {
    const keys = this.userCacheKeys.get(userId);
    if (!keys) {
      return;
    }
    keys.delete(cacheKey);
    if (keys.size === 0) {
      this.userCacheKeys.delete(userId);
    }
  }

  private getFromCache(cacheKey: string): SearchResult[] | null {
    const entry = this.cache.get(cacheKey);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(cacheKey);
      this.unlinkCacheKey(entry.userId, cacheKey);
      return null;
    }

    // Refresh TTL and LRU position
    this.cache.delete(cacheKey);
    entry.expiresAt = Date.now() + SEARCH_CACHE_TTL_MS;
    this.cache.set(cacheKey, entry);

    return entry.value.map((result) => ({
      ...result,
      scores: result.scores ? { ...result.scores } : undefined,
    }));
  }

  private storeInCache(userId: string, cacheKey: string, value: SearchResult[]): void {
    const entry: CacheEntry = {
      userId,
      expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
      value: value.map((result) => ({
        ...result,
        scores: result.scores ? { ...result.scores } : undefined,
      })),
    };

    if (this.cache.has(cacheKey)) {
      this.cache.delete(cacheKey);
    }
    this.cache.set(cacheKey, entry);

    let keys = this.userCacheKeys.get(userId);
    if (!keys) {
      keys = new Set<string>();
      this.userCacheKeys.set(userId, keys);
    }
    keys.add(cacheKey);

    this.pruneCache();
  }

  private pruneCache(): void {
    while (this.cache.size > SEARCH_CACHE_MAX_ENTRIES) {
      const oldestKey = this.cache.keys().next().value as string | undefined;
      if (!oldestKey) {
        break;
      }
      const oldestEntry = this.cache.get(oldestKey);
      if (oldestEntry) {
        this.unlinkCacheKey(oldestEntry.userId, oldestKey);
      }
      this.cache.delete(oldestKey);
    }
  }

  public invalidateForUser(userId: string): void {
    const keys = this.userCacheKeys.get(userId);
    if (!keys) {
      return;
    }
    for (const key of keys) {
      this.cache.delete(key);
    }
    this.userCacheKeys.delete(userId);
  }

  public async invalidateForItem(itemId: string): Promise<void> {
    if (!itemId) {
      return;
    }
    try {
      const result = await pool.query<{
        owner_id: string;
        shared_user_ids: string[] | null;
      }>(
        `
          SELECT
            owner_id,
            ARRAY(
              SELECT DISTINCT user_id::text
              FROM item_access
              WHERE item_id = $1
                AND user_id IS NOT NULL
            ) AS shared_user_ids
          FROM items
          WHERE id = $1
        `,
        [itemId]
      );

      if (result.rowCount && result.rows[0]) {
        const { owner_id: ownerId, shared_user_ids: sharedUserIds } = result.rows[0];
        if (ownerId) {
          this.invalidateForUser(ownerId);
        }
        if (Array.isArray(sharedUserIds)) {
          for (const sharedUserId of sharedUserIds) {
            if (sharedUserId) {
              this.invalidateForUser(sharedUserId);
            }
          }
        }
      }
    } catch (error) {
      console.warn('[Search] Failed to invalidate cache for item', itemId, error);
      this.clearCache();
    }
  }

  public clearCache(): void {
    this.cache.clear();
    this.userCacheKeys.clear();
  }

  async search(
    user: { id: string; email?: string | null },
    query: string,
    limit: number = 10,
    filters?: SearchFilters,
    offset: number = 0
  ): Promise<SearchResult[]> {
    const startedAt = Date.now();
    const userId = user?.id ?? null;
    const queryPreview = query.length > 120 ? `${query.slice(0, 117)}...` : query;
    const filterSignature = this.serializeFilters(filters);
    // For caching, we fetch all results up to max limit (50) without offset
    // Cache key doesn't include offset since we cache the full result set
    const maxLimit = 50;
    const cacheKey =
      user?.id && query ? this.buildCacheKey(user.id, query, maxLimit, filters) : null;

    if (cacheKey && offset === 0) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        // Return cached results with offset applied
        return cached.slice(offset, offset + limit);
      }
    }

    const escapedQuery = query.replace(/%/g, '\\%').replace(/_/g, '\\_');
    const searchTerms = query.toLowerCase().split(/\s+/).filter((term) => term.length > 0);

    // Fetch more results to support pagination (up to maxLimit)
    const fetchLimit = Math.min(maxLimit, limit + offset);
    const semanticResults = await this.semanticSearch(user, query, searchTerms, fetchLimit * 2, filters);
    const textResults = await this.textSearch(user, escapedQuery, searchTerms, fetchLimit * 2, filters);

    // Combine and sort all results, then apply offset and limit
    const combinedResults = this.combineResults(semanticResults, textResults, fetchLimit);
    const paginatedResults = combinedResults.slice(offset, offset + limit);

    // Only cache if offset is 0 (first page)
    if (cacheKey && user?.id && offset === 0) {
      this.storeInCache(user.id, cacheKey, combinedResults);
    }

    return paginatedResults;
  }

  private async semanticSearch(
    user: { id: string; email?: string | null },
    query: string,
    searchTerms: string[],
    limit: number,
    filters?: SearchFilters
  ): Promise<SearchResult[]> {
    if (!user?.id) {
      return [];
    }

    const titlePatterns = searchTerms
      .filter((term) => term.trim().length > 0)
      .map((term) => `%${term.toLowerCase()}%`);

    const similarEmbeddings = await embeddingService.findSimilar(query, {
      userId: user.id,
      email: user.email,
      limit,
      titlePatterns,
      filters,
    });

    const mappedResults = similarEmbeddings.map<SearchResult | null>((result) => {
      const entityId =
        result.entityType === 'item'
          ? result.item?.id
          : result.entityType === 'contact'
          ? result.contact?.id
          : result.entityType === 'user'
          ? result.user?.id
          : undefined;

      if (!entityId) {
        return null;
      }

      return {
        entityType: result.entityType,
        entityId,
        item: result.item ?? undefined,
        contact: result.contact ?? undefined,
        user: result.user ?? undefined,
        document: result.document
          ? {
              title: result.document.title,
              summary: result.document.summary,
              tags: result.document.tags,
              metadata: result.document.metadata ?? {},
            }
          : undefined,
        similarity: result.overallScore,
        scores: {
          overall: result.overallScore,
          vector: result.vectorScore,
          recency: result.recencyScore,
          tagBoost: result.tagBoost,
          titleBoost: result.titleBoost,
          ownerBoost: result.ownerBoost,
        },
      };
    });

    return mappedResults.filter((value): value is SearchResult => value !== null);
  }

  private async textSearch(
    user: { id: string; email?: string | null },
    escapedQuery: string,
    searchTerms: string[],
    limit: number,
    filters?: SearchFilters
  ): Promise<SearchResult[]> {
    if (!user?.id) {
      return [];
    }

    const normalizedEmail = user.email ? itemAccessEmailNormalizer(user.email) : null;
    const params: any[] = [user.id];

    const addParam = (value: any) => {
      params.push(value);
      return `$${params.length}`;
    };

    const textMatchClauses: string[] = [];
    for (const rawTerm of searchTerms) {
      const term = rawTerm.trim().toLowerCase();
      if (!term) {
        continue;
      }

      const titleParam = addParam(`%${term}%`);
      const summaryParam = addParam(`%${term}%`);
      const contentParam = addParam(`%${term}%`);
      const tagParam = addParam(`%${term}%`);

      textMatchClauses.push(`(
        (sd.title IS NOT NULL AND LOWER(sd.title) LIKE ${titleParam})
        OR (sd.summary IS NOT NULL AND LOWER(sd.summary) LIKE ${summaryParam})
        OR (sd.content IS NOT NULL AND LOWER(sd.content) LIKE ${contentParam})
        OR (
          sd.tags IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM unnest(sd.tags) tag
            WHERE LOWER(tag) LIKE ${tagParam}
          )
        )
      )`);
    }

    if (textMatchClauses.length === 0) {
      const likeParam = addParam(`%${escapedQuery.toLowerCase()}%`);
      textMatchClauses.push(`(
        (sd.title IS NOT NULL AND LOWER(sd.title) LIKE ${likeParam})
        OR (sd.summary IS NOT NULL AND LOWER(sd.summary) LIKE ${likeParam})
        OR (sd.content IS NOT NULL AND LOWER(sd.content) LIKE ${likeParam})
      )`);
    }

    const entitiesFilter = sanitizeArray(filters?.entities as string[] | undefined, false);
    const typesFilter = sanitizeArray(filters?.types);
    const tagsFilter = sanitizeArray(filters?.tags);
    const sourcesFilter = sanitizeArray(filters?.sources, false);
    const dateFrom = parseDate(filters?.dateFrom);
    const dateTo = parseDate(filters?.dateTo);
    const hasAttachments =
      typeof filters?.hasAttachments === 'boolean' ? filters.hasAttachments : null;
    const uploadedBy =
      filters?.uploadedBy && ['me', 'shared'].includes(filters.uploadedBy)
        ? filters.uploadedBy
        : null;
    const fileType = filters?.fileType ?? null;

    const normalizedEmailPlaceholder = addParam(normalizedEmail);
    const entitiesPlaceholder = addParam(entitiesFilter);
    const typesPlaceholder = addParam(typesFilter);
    const tagsPlaceholder = addParam(tagsFilter);
    const dateFromPlaceholder = addParam(dateFrom);
    const dateToPlaceholder = addParam(dateTo);
    const hasAttachmentsPlaceholder = addParam(hasAttachments);
    const sourcesPlaceholder = addParam(sourcesFilter);
    const uploadedByPlaceholder = addParam(uploadedBy);
    const fileTypePlaceholder = addParam(fileType);
    const limitPlaceholder = addParam(limit);
    const rawLikeParam = addParam(`%${escapedQuery.toLowerCase()}%`);

    const textClause = `(${textMatchClauses.join(' OR ')})`;

    const query = `
      SELECT
        sd.id AS document_id,
        sd.entity_type,
        sd.entity_id,
        sd.title,
        sd.summary,
        sd.tags,
        sd.metadata,
        row_to_json(i) AS item_json,
        row_to_json(c) AS contact_json,
        row_to_json(u) AS user_json,
        CASE
          WHEN sd.title IS NOT NULL AND LOWER(sd.title) LIKE ${rawLikeParam} THEN 1.0
          WHEN sd.summary IS NOT NULL AND LOWER(sd.summary) LIKE ${rawLikeParam} THEN 0.9
          WHEN sd.content IS NOT NULL AND LOWER(sd.content) LIKE ${rawLikeParam} THEN 0.8
          ELSE 0.6
        END AS text_similarity
      FROM search_documents sd
      LEFT JOIN items i ON sd.entity_type = 'item' AND sd.entity_id = i.id
      LEFT JOIN contacts c ON sd.entity_type = 'contact' AND sd.entity_id = c.id
      LEFT JOIN users u ON sd.entity_type = 'user' AND sd.entity_id = u.id
      WHERE ${textClause}
        AND (
          sd.entity_type <> 'item'
          OR (i.deleted_at IS NULL OR i.deleted_at > NOW())
        )
        AND (
          sd.owner_id = $1
          OR (
            sd.entity_type = 'item'
            AND EXISTS (
              SELECT 1
              FROM item_access ia
              WHERE ia.item_id = sd.entity_id
                AND (
                  ia.user_id = $1
                  OR (${normalizedEmailPlaceholder}::text IS NOT NULL AND ia.normalized_email = ${normalizedEmailPlaceholder}::text)
                )
            )
          )
          OR (
            sd.entity_type = 'user'
            AND sd.owner_id = $1
          )
        )
        AND (
          ${entitiesPlaceholder}::text[] IS NULL
          OR sd.entity_type = ANY(${entitiesPlaceholder}::text[])
        )
        AND (
          ${typesPlaceholder}::text[] IS NULL
          OR (
            sd.entity_type = 'item'
            AND i.type = ANY(${typesPlaceholder}::text[])
          )
        )
        AND (
          ${tagsPlaceholder}::text[] IS NULL
          OR (
            sd.tags IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM unnest(sd.tags) tag
              WHERE LOWER(tag) = ANY(${tagsPlaceholder}::text[])
            )
          )
        )
        AND (
          ${dateFromPlaceholder}::timestamptz IS NULL
          OR COALESCE(i.created_at, c.updated_at, u.updated_at, sd.updated_at, sd.created_at) >= ${dateFromPlaceholder}::timestamptz
        )
        AND (
          ${dateToPlaceholder}::timestamptz IS NULL
          OR COALESCE(i.created_at, c.updated_at, u.updated_at, sd.updated_at, sd.created_at) <= ${dateToPlaceholder}::timestamptz
        )
        AND (
          ${hasAttachmentsPlaceholder}::boolean IS NULL
          OR (
            ${hasAttachmentsPlaceholder} = TRUE
            AND sd.entity_type = 'item'
            AND i.attachments IS NOT NULL
            AND jsonb_array_length(i.attachments) > 0
          )
        )
        AND (
          ${sourcesPlaceholder}::text[] IS NULL
          OR (
            sd.entity_type = 'item'
            AND i.source = ANY(${sourcesPlaceholder}::text[])
          )
        )
        AND (
          ${uploadedByPlaceholder}::text IS NULL
          OR (
            sd.entity_type = 'item'
            AND (
              (${uploadedByPlaceholder} = 'me' AND i.owner_id = $1)
              OR (${uploadedByPlaceholder} = 'shared' AND i.owner_id <> $1)
            )
          )
        )
        AND (
          ${fileTypePlaceholder}::text IS NULL
          OR (
            sd.entity_type = 'item'
            AND i.attachments IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements(i.attachments) AS attachment
              WHERE CASE
                WHEN ${fileTypePlaceholder} = 'image' THEN (attachment->>'mimetype')::text LIKE 'image/%'
                WHEN ${fileTypePlaceholder} = 'spreadsheet' THEN (attachment->>'mimetype')::text IN (
                  'application/vnd.ms-excel',
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                  'application/vnd.oasis.opendocument.spreadsheet',
                  'text/csv',
                  'application/csv'
                )
                WHEN ${fileTypePlaceholder} = 'document' THEN (attachment->>'mimetype')::text IN (
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
      ORDER BY text_similarity DESC, sd.updated_at DESC
      LIMIT ${limitPlaceholder}
    `;

    try {
      const result = await pool.query(query, params);
      return result.rows
        .map((row: any) => {
          const entityId =
          row.entity_type === 'item'
              ? row.item_json?.id
              : row.entity_type === 'contact'
              ? row.contact_json?.id
              : row.entity_type === 'user'
              ? row.user_json?.id
              : undefined;

          if (!entityId) {
            return null;
          }

          const similarity = parseFloat(row.text_similarity) || 0.6;
          return {
            entityType: row.entity_type as 'item' | 'contact' | 'user',
            entityId,
            item:
              row.item_json && typeof row.item_json === 'object'
                ? row.item_json
                : undefined,
            contact:
              row.contact_json && typeof row.contact_json === 'object'
                ? row.contact_json
                : undefined,
            user:
              row.user_json && typeof row.user_json === 'object'
                ? row.user_json
                : undefined,
            document: {
              title: row.title ?? null,
              summary: row.summary ?? null,
              tags: row.tags ?? null,
              metadata:
                row.metadata && typeof row.metadata === 'object'
                  ? (row.metadata as Record<string, unknown>)
                  : {},
            },
            similarity,
            scores: {
              overall: similarity,
              vector: 0,
              recency: 0,
              tagBoost: 0,
              titleBoost: 0,
              ownerBoost: 0,
            },
          } as SearchResult;
        })
        .filter((value): value is SearchResult => Boolean(value));
    } catch (error) {
      console.error('[Search] Error in text search:', error);
      return [];
    }
  }

  private combineResults(
    semanticResults: SearchResult[],
    textResults: SearchResult[],
    limit: number
  ): SearchResult[] {
    const resultMap = new Map<string, SearchResult>();

    const mapKey = (result: SearchResult) => `${result.entityType}:${result.entityId}`;

    for (const result of semanticResults) {
      const key = mapKey(result);
      const existing = resultMap.get(key);
      if (!existing || result.similarity > existing.similarity) {
        resultMap.set(key, { ...result });
      }
    }

    for (const result of textResults) {
      const key = mapKey(result);
      const existing = resultMap.get(key);
      if (existing) {
        const boost = 0.1;
        existing.similarity = Math.min(1.0, existing.similarity + boost);
        if (existing.scores) {
          existing.scores.overall = existing.similarity;
        }
      } else {
        resultMap.set(key, { ...result });
      }
    }

    const combined = Array.from(resultMap.values());
    combined.sort((a, b) => b.similarity - a.similarity);

    // Return all results up to limit (pagination will be applied in search method)
    return combined.slice(0, limit);
  }
}

export const searchService = new SearchService();
