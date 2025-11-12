import { type SemanticSimilarityResult } from '../models/Embedding.js';
export declare class EmbeddingService {
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