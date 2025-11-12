import type { Item } from './Item.js';
import type { Contact } from './Contact.js';
import type { User } from './User.js';
import type { SearchFilters } from '../types/search.js';
import type { SearchEntityType } from './SearchDocument.js';
export interface SemanticSimilarityResult {
    documentId: string;
    entityType: SearchEntityType;
    document: {
        title: string | null;
        summary: string | null;
        content: string | null;
        tags: string[] | null;
        metadata: Record<string, unknown> | null;
    };
    item?: Item;
    contact?: Contact;
    user?: User;
    vectorScore: number;
    recencyScore: number;
    tagBoost: number;
    titleBoost: number;
    ownerBoost: number;
    overallScore: number;
}
export interface Embedding {
    id: string;
    document_id: string;
    embedding: number[];
    created_at: Date;
}
export declare class EmbeddingModel {
    static create(documentId: string, embedding: number[]): Promise<Embedding>;
    static deleteByDocumentId(documentId: string): Promise<boolean>;
    static findSimilar(queryEmbedding: number[], options: {
        userId: string;
        email?: string | null;
        limit?: number;
        candidateMultiplier?: number;
        titlePatterns?: string[];
        filters?: SearchFilters;
    }): Promise<SemanticSimilarityResult[]>;
}
//# sourceMappingURL=Embedding.d.ts.map