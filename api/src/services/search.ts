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

export interface SearchResult {
  item: any;
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

    const sortArray = (values: string[] | undefined) =>
      values ? [...values].map((value) => value.toString()).sort() : undefined;

    if (filters.types?.length) {
      entries.push(['types', sortArray(filters.types)]);
    }
    if (filters.tags?.length) {
      entries.push(['tags', sortArray(filters.tags)]);
    }
    if (filters.sources?.length) {
      entries.push(['sources', sortArray(filters.sources)]);
    }
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
    filters?: SearchFilters
  ): Promise<SearchResult[]> {
    const startedAt = Date.now();
    const userId = user?.id ?? null;
    const queryPreview = query.length > 120 ? `${query.slice(0, 117)}...` : query;
    const filterSignature = this.serializeFilters(filters);
    const cacheKey =
      user?.id && query
        ? this.buildCacheKey(user.id, query, limit, filters)
        : null;

    if (cacheKey) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        console.debug('[Search] cache hit', {
          userId,
          query: queryPreview,
          filters: filterSignature,
          durationMs: Date.now() - startedAt,
          results: cached.length,
          limit,
        });
        return cached;
      }
    }

    // Escape query for SQL LIKE pattern (basic sanitization)
    const escapedQuery = query.replace(/%/g, '\\%').replace(/_/g, '\\_');
    const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);

    // 1. Semantic search via embeddings
    const semanticResults = await this.semanticSearch(user, query, searchTerms, limit * 2, filters);

    // 2. Direct text search on notes and link_metadata
    const textResults = await this.textSearch(user, escapedQuery, searchTerms, limit * 2, filters);

    // Combine and deduplicate results
    const combinedResults = this.combineResults(semanticResults, textResults, limit);

    if (cacheKey && user?.id) {
      this.storeInCache(user.id, cacheKey, combinedResults);
    }

    console.debug('[Search] executed', {
      userId,
      query: queryPreview,
      filters: filterSignature,
      limit,
      durationMs: Date.now() - startedAt,
      semanticCount: semanticResults.length,
      textCount: textResults.length,
      resultCount: combinedResults.length,
      cacheable: Boolean(cacheKey),
    });

    return combinedResults;
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

    return similarEmbeddings.map((result) => ({
      item: result.item,
      similarity: result.overallScore,
      scores: {
        overall: result.overallScore,
        vector: result.vectorScore,
        recency: result.recencyScore,
        tagBoost: result.tagBoost,
        titleBoost: result.titleBoost,
        ownerBoost: result.ownerBoost,
      },
    }));
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
    const params: any[] = [user.id, normalizedEmail];

    const addParam = (value: any) => {
      params.push(value);
      return `$${params.length}`;
    };

    const textMatchClauses: string[] = [];
    const metadataClauses: string[] = [];

    for (const rawTerm of searchTerms) {
      const term = rawTerm.trim().toLowerCase();
      if (!term) {
        continue;
      }

      const titleParam = addParam(`%${term}%`);
      const descriptionParam = addParam(`%${term}%`);
      const urlParam = addParam(`%${term}%`);
      const notesParam = addParam(`%${term}%`);
      textMatchClauses.push(`(
        (i.title IS NOT NULL AND LOWER(i.title) LIKE ${titleParam})
        OR (i.description IS NOT NULL AND LOWER(i.description) LIKE ${descriptionParam})
        OR (i.url IS NOT NULL AND LOWER(i.url) LIKE ${urlParam})
        OR (i.notes IS NOT NULL AND LOWER(i.notes) LIKE ${notesParam})
      )`);

      const metadataTitleParam = addParam(`%${term}%`);
      const metadataDescriptionParam = addParam(`%${term}%`);
      const metadataUrlParam = addParam(`%${term}%`);
      metadataClauses.push(`(
        (i.link_metadata->>'title') IS NOT NULL AND LOWER(i.link_metadata->>'title') LIKE ${metadataTitleParam}
        OR (i.link_metadata->>'description') IS NOT NULL AND LOWER(i.link_metadata->>'description') LIKE ${metadataDescriptionParam}
        OR (i.link_metadata->>'url') IS NOT NULL AND LOWER(i.link_metadata->>'url') LIKE ${metadataUrlParam}
      )`);
    }

    if (textMatchClauses.length === 0 && metadataClauses.length === 0) {
      return [];
    }

    const sanitizeStringArray = (values?: string[], toLower: boolean = true) => {
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

    const parsedDate = (value?: string) => {
      if (!value) {
        return null;
      }
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    };

    const sanitizedFilters = {
      types: sanitizeStringArray(filters?.types),
      tags: sanitizeStringArray(filters?.tags),
      sources: sanitizeStringArray(filters?.sources, false),
      dateFrom: parsedDate(filters?.dateFrom),
      dateTo: parsedDate(filters?.dateTo),
      hasAttachments: typeof filters?.hasAttachments === 'boolean' ? filters.hasAttachments : null,
      uploadedBy:
        filters?.uploadedBy && ['me', 'shared'].includes(filters.uploadedBy) ? filters.uploadedBy : null,
    };

    const similarityLikeParam = addParam(`%${escapedQuery.toLowerCase()}%`);
    const similarityCase = `CASE
      WHEN i.title IS NOT NULL AND LOWER(i.title) LIKE ${similarityLikeParam} THEN 1.0
      WHEN i.notes IS NOT NULL AND LOWER(i.notes) LIKE ${similarityLikeParam} THEN 0.9
      WHEN i.description IS NOT NULL AND LOWER(i.description) LIKE ${similarityLikeParam} THEN 0.8
      WHEN i.link_metadata IS NOT NULL THEN 0.7
      ELSE 0.5
    END`;

    const typesPlaceholder = addParam(sanitizedFilters.types);
    const tagsPlaceholder = addParam(sanitizedFilters.tags);
    const dateFromPlaceholder = addParam(sanitizedFilters.dateFrom);
    const dateToPlaceholder = addParam(sanitizedFilters.dateTo);
    const hasAttachmentsPlaceholder = addParam(sanitizedFilters.hasAttachments);
    const sourcesPlaceholder = addParam(sanitizedFilters.sources);
    const uploadedByPlaceholder = addParam(sanitizedFilters.uploadedBy);
    const limitPlaceholder = addParam(limit);

    const textClause = textMatchClauses.length > 0 ? `(${textMatchClauses.join(' OR ')})` : null;
    const metadataClause = metadataClauses.length > 0 ? `(${metadataClauses.join(' OR ')})` : null;

    const query = `
      SELECT
        i.*,
        ${similarityCase} AS text_similarity
      FROM items i
      WHERE i.deleted_at IS NULL
        AND (
          i.owner_id = $1
          OR EXISTS (
            SELECT 1
            FROM item_access ia
            WHERE ia.item_id = i.id
              AND (
                ia.user_id = $1
                OR ($2 IS NOT NULL AND ia.normalized_email = $2)
              )
          )
        )
        ${textClause ? `AND ${textClause}` : ''}
        ${metadataClause ? `AND ${metadataClause}` : ''}
        AND (
          ${typesPlaceholder}::text[] IS NULL
          OR i.type = ANY(${typesPlaceholder}::text[])
        )
        AND (
          ${tagsPlaceholder}::text[] IS NULL
          OR (
            i.tags IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM unnest(i.tags) tag
              WHERE LOWER(tag) = ANY(${tagsPlaceholder}::text[])
            )
          )
        )
        AND (
          ${dateFromPlaceholder}::timestamptz IS NULL
          OR i.created_at >= ${dateFromPlaceholder}::timestamptz
        )
        AND (
          ${dateToPlaceholder}::timestamptz IS NULL
          OR i.created_at <= ${dateToPlaceholder}::timestamptz
        )
        AND (
          ${hasAttachmentsPlaceholder}::boolean IS NULL
          OR (
            ${hasAttachmentsPlaceholder} = TRUE
            AND i.attachments IS NOT NULL
            AND jsonb_array_length(i.attachments) > 0
          )
        )
        AND (
          ${sourcesPlaceholder}::text[] IS NULL
          OR i.source = ANY(${sourcesPlaceholder}::text[])
        )
        AND (
          ${uploadedByPlaceholder}::text IS NULL
          OR (${uploadedByPlaceholder} = 'me' AND i.owner_id = $1)
          OR (${uploadedByPlaceholder} = 'shared' AND i.owner_id <> $1)
        )
      ORDER BY text_similarity DESC, i.created_at DESC
      LIMIT ${limitPlaceholder}
    `;

    try {
      const result = await pool.query(query, params);
      return result.rows.map((row: any) => {
        const similarity = parseFloat(row.text_similarity) || 0.5;
        return {
          item: row,
          similarity,
          scores: {
            overall: similarity,
            vector: 0,
            recency: 0,
            tagBoost: 0,
            titleBoost: 0,
            ownerBoost: 0,
          },
        };
      });
    } catch (error) {
      console.error('Error in text search:', error);
      return [];
    }
  }

  private combineResults(
    semanticResults: SearchResult[],
    textResults: SearchResult[],
    limit: number
  ): SearchResult[] {
    // Create a map to deduplicate by item ID
    const resultMap = new Map<string, SearchResult>();

    // Add semantic results first (they have more nuanced similarity scores)
    for (const result of semanticResults) {
      const existing = resultMap.get(result.item.id);
      if (!existing || result.similarity > existing.similarity) {
        resultMap.set(result.item.id, result);
      }
    }

    // Add text search results, boosting similarity if item already exists
    for (const result of textResults) {
      const existing = resultMap.get(result.item.id);
      if (existing) {
        // Boost similarity if found in both semantic and text search
        const boost = 0.1;
        existing.similarity = Math.min(1.0, existing.similarity + boost);
        if (existing.scores) {
          existing.scores.overall = existing.similarity;
        }
      } else {
        resultMap.set(result.item.id, result);
      }
    }

    // Convert to array and sort by similarity
    const combined = Array.from(resultMap.values());
    combined.sort((a, b) => b.similarity - a.similarity);

    return combined.slice(0, limit);
  }
}

export const searchService = new SearchService();
