export declare class EmbeddingService {
    createEmbedding(itemId: string, text: string): Promise<string>;
    findSimilar(queryText: string, limit?: number): Promise<Array<{
        embedding: import('../models/Embedding.js').Embedding;
        similarity: number;
    }>>;
}
export declare const embeddingService: EmbeddingService;
//# sourceMappingURL=embeddings.d.ts.map