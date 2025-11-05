import { embeddingService } from './embeddings.js';
import { ItemModel } from '../models/Item.js';
import { EmbeddingModel } from '../models/Embedding.js';
import pool from '../config/database.js';

export interface SearchResult {
  item: any;
  similarity: number;
}

export class SearchService {
  async search(ownerId: string, query: string, limit: number = 10): Promise<SearchResult[]> {
    // Escape query for SQL LIKE pattern (basic sanitization)
    const escapedQuery = query.replace(/%/g, '\\%').replace(/_/g, '\\_');
    const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);

    // 1. Semantic search via embeddings
    const semanticResults = await this.semanticSearch(ownerId, query, limit * 2);

    // 2. Direct text search on notes and link_metadata
    const textResults = await this.textSearch(ownerId, escapedQuery, searchTerms, limit * 2);

    // Combine and deduplicate results
    const combinedResults = this.combineResults(semanticResults, textResults, limit);

    return combinedResults;
  }

  private async semanticSearch(ownerId: string, query: string, limit: number): Promise<SearchResult[]> {
    // Find similar embeddings
    const similarEmbeddings = await embeddingService.findSimilar(query, limit);

    // Get items for these embeddings and filter by owner
    const results: SearchResult[] = [];

    for (const { embedding, similarity } of similarEmbeddings) {
      const item = await ItemModel.findById(embedding.item_id);

      if (item && item.owner_id === ownerId) {
        results.push({
          item,
          similarity,
        });
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity);
  }

  private async textSearch(ownerId: string, escapedQuery: string, searchTerms: string[], limit: number): Promise<SearchResult[]> {
    // Build search conditions for unified fields
    const conditions: string[] = [];
    const params: any[] = [ownerId];
    let paramCount = 1;

    // Search in unified fields: title, description, url, notes
    for (const term of searchTerms) {
      if (term.trim()) {
        const fieldConditions: string[] = [];
        fieldConditions.push(`(title IS NOT NULL AND LOWER(title) LIKE $${++paramCount})`);
        params.push(`%${term}%`);
        fieldConditions.push(`(description IS NOT NULL AND LOWER(description) LIKE $${++paramCount})`);
        params.push(`%${term}%`);
        fieldConditions.push(`(url IS NOT NULL AND LOWER(url) LIKE $${++paramCount})`);
        params.push(`%${term}%`);
        fieldConditions.push(`(notes IS NOT NULL AND LOWER(notes) LIKE $${++paramCount})`);
        params.push(`%${term}%`);
        conditions.push(`(${fieldConditions.join(' OR ')})`);
      }
    }

    // Search in link_metadata JSONB (for backward compatibility)
    const jsonbConditions: string[] = [];
    for (const term of searchTerms) {
      const termConditions: string[] = [];
      if (term.trim()) {
        termConditions.push(`(link_metadata->>'title' IS NOT NULL AND LOWER(link_metadata->>'title') LIKE $${++paramCount})`);
        params.push(`%${term}%`);
        termConditions.push(`(link_metadata->>'description' IS NOT NULL AND LOWER(link_metadata->>'description') LIKE $${++paramCount})`);
        params.push(`%${term}%`);
        termConditions.push(`(link_metadata->>'url' IS NOT NULL AND LOWER(link_metadata->>'url') LIKE $${++paramCount})`);
        params.push(`%${term}%`);
        jsonbConditions.push(`(${termConditions.join(' OR ')})`);
      }
    }

    if (jsonbConditions.length > 0) {
      conditions.push(`(link_metadata IS NOT NULL AND (${jsonbConditions.join(' OR ')}))`);
    }

    // If no conditions, return empty results
    if (conditions.length === 0) {
      return [];
    }

    // Build similarity score calculation (prioritize title matches)
    const similarityCase = `CASE
      WHEN title IS NOT NULL AND LOWER(title) LIKE '%${escapedQuery.toLowerCase()}%' THEN 1.0
      WHEN notes IS NOT NULL AND LOWER(notes) LIKE '%${escapedQuery.toLowerCase()}%' THEN 0.9
      WHEN description IS NOT NULL AND LOWER(description) LIKE '%${escapedQuery.toLowerCase()}%' THEN 0.8
      WHEN link_metadata IS NOT NULL THEN 0.7
      ELSE 0.5
    END`;

    // Build the query (search all items, not just links)
    const query = `
      SELECT *,
        ${similarityCase} as text_similarity
      FROM items
      WHERE owner_id = $1
        AND (${conditions.join(' OR ')})
      ORDER BY text_similarity DESC, created_at DESC
      LIMIT $${++paramCount}
    `;
    params.push(limit);

    try {
      const result = await pool.query(query, params);
      return result.rows.map((row) => ({
        item: row,
        similarity: parseFloat(row.text_similarity) || 0.5,
      }));
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
        existing.similarity = Math.min(1.0, existing.similarity + 0.1);
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
