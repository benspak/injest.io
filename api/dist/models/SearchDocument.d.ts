export type SearchEntityType = 'item' | 'contact' | 'user';
export interface SearchDocument {
    id: string;
    owner_id: string;
    entity_type: SearchEntityType;
    entity_id: string;
    title: string | null;
    content: string | null;
    summary: string | null;
    tags: string[] | null;
    metadata: Record<string, unknown> | null;
    created_at: Date;
    updated_at: Date;
}
export interface UpsertSearchDocumentInput {
    ownerId: string;
    entityType: SearchEntityType;
    entityId: string;
    title?: string | null;
    content?: string | null;
    summary?: string | null;
    tags?: string[] | null;
    metadata?: Record<string, unknown> | null;
}
export declare class SearchDocumentModel {
    static upsert(input: UpsertSearchDocumentInput): Promise<SearchDocument>;
    static findByEntity(entityType: SearchEntityType, entityId: string): Promise<SearchDocument | null>;
    static deleteByEntity(entityType: SearchEntityType, entityId: string): Promise<void>;
}
//# sourceMappingURL=SearchDocument.d.ts.map