export interface Embedding {
    id: string;
    item_id: string;
    embedding: number[];
    created_at: Date;
    similarity?: number | string;
}
export declare class EmbeddingModel {
    static create(itemId: string, embedding: number[]): Promise<Embedding>;
    static findByItemId(itemId: string): Promise<Embedding | null>;
    static findSimilar(queryEmbedding: number[], limit?: number): Promise<Array<Embedding & {
        similarity: number | string;
    }>>;
    static deleteByItemId(itemId: string): Promise<boolean>;
}
//# sourceMappingURL=Embedding.d.ts.map