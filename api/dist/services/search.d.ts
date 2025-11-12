import type { SearchFilters } from '../types/search.js';
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
    entityType: 'item' | 'contact';
    entityId: string;
    item?: any;
    contact?: any;
    document?: SearchResultDocument;
    similarity: number;
    scores?: SearchResultScores;
}
export declare class SearchService {
    private cache;
    private userCacheKeys;
    private buildCacheKey;
    private serializeFilters;
    private unlinkCacheKey;
    private getFromCache;
    private storeInCache;
    private pruneCache;
    invalidateForUser(userId: string): void;
    invalidateForItem(itemId: string): Promise<void>;
    clearCache(): void;
    search(user: {
        id: string;
        email?: string | null;
    }, query: string, limit?: number, filters?: SearchFilters): Promise<SearchResult[]>;
    private semanticSearch;
    private textSearch;
    private combineResults;
}
export declare const searchService: SearchService;
//# sourceMappingURL=search.d.ts.map