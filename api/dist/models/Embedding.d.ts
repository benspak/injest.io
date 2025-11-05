export interface Embedding {
    id: string;
    item_id: string;
    embedding: number[];
    created_at: Date;
}
export declare class EmbeddingModel {
    static create(itemId: string, embedding: number[]): Promise<Embedding>;
    static findByItemId(itemId: string): Promise<Embedding | null>;
    static findSimilar(queryEmbedding: number[], limit?: number): Promise<Embedding[]>;
    static deleteByItemId(itemId: string): Promise<boolean>;
}
//# sourceMappingURL=Embedding.d.ts.map