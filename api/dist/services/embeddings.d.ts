import { EmbeddingModel } from '../models/Embedding.js';
export declare class EmbeddingService {
    createEmbedding(itemId: string, text: string): Promise<string>;
    findSimilar(queryText: string, limit?: number): Promise<Array<{
        embedding: EmbeddingModel;
        similarity: number;
    }>>;
}
export declare const embeddingService: EmbeddingService;
//# sourceMappingURL=embeddings.d.ts.map