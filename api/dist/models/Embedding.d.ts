import type { Item } from './Item.js';
import type { SearchFilters } from '../types/search.js';
export interface SemanticSimilarityResult {
    item: Item;
    vectorScore: number;
    recencyScore: number;
    tagBoost: number;
    titleBoost: number;
    ownerBoost: number;
    overallScore: number;
}
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
    static findSimilar(queryEmbedding: number[], options: {
        userId: string;
        email?: string | null;
        limit?: number;
        candidateMultiplier?: number;
        titlePatterns?: string[];
        filters?: SearchFilters;
    }): Promise<SemanticSimilarityResult[]>;
    static deleteByItemId(itemId: string): Promise<boolean>;
}
//# sourceMappingURL=Embedding.d.ts.map