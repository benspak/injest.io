import { type SemanticSimilarityResult } from '../models/Embedding.js';
export declare class EmbeddingService {
    /**
     * Truncate text to fit within token limits for embedding models
     * text-embedding-3-small: 8192 tokens max (~30,000 chars conservative estimate)
     * text-embedding-3-large: 8192 tokens max (~30,000 chars conservative estimate)
     *
     * Preserves the end of the text as it often contains more important information
     */
    private truncateForEmbedding;
    createEmbedding(documentId: string, text: string): Promise<string>;
    findSimilar(queryText: string, options: {
        userId: string;
        email?: string | null;
        limit?: number;
        candidateMultiplier?: number;
        titlePatterns?: string[];
        filters?: import('../types/search.js').SearchFilters;
    }): Promise<SemanticSimilarityResult[]>;
}
export declare const embeddingService: EmbeddingService;
//# sourceMappingURL=embeddings.d.ts.map