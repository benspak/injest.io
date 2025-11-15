import { PoolClient } from 'pg';
export interface Collection {
    id: string;
    owner_id: string;
    title: string;
    description?: string | null;
    color?: string | null;
    icon?: string | null;
    created_at: Date;
    updated_at: Date;
}
export interface CreateCollectionInput {
    owner_id: string;
    title: string;
    description?: string;
    color?: string;
    icon?: string;
}
export declare class CollectionModel {
    static create(input: CreateCollectionInput, client?: PoolClient): Promise<Collection>;
    static findById(id: string): Promise<Collection | null>;
    static findByOwner(ownerId: string): Promise<Collection[]>;
    static update(id: string, updates: Partial<Collection>): Promise<Collection>;
    static delete(id: string): Promise<boolean>;
}
//# sourceMappingURL=Collection.d.ts.map