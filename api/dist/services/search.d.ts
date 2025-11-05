export interface SearchResult {
    item: any;
    similarity: number;
}
export declare class SearchService {
    search(ownerId: string, query: string, limit?: number): Promise<SearchResult[]>;
    private semanticSearch;
    private textSearch;
    private combineResults;
}
export declare const searchService: SearchService;
//# sourceMappingURL=search.d.ts.map