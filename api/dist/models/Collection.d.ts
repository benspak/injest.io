import { PoolClient } from 'pg';
export interface Collection {
    id: string;
    owner_id: string;
    title: string;
    description?: string | null;
    color?: string | null;
    icon?: string | null;
    posted_to_profile?: boolean;
    is_publicly_shareable?: boolean;
    share_token?: string | null;
    created_at: Date;
    updated_at: Date;
}
export interface CreateCollectionInput {
    owner_id: string;
    title: string;
    description?: string;
    color?: string;
    icon?: string;
    posted_to_profile?: boolean;
    is_publicly_shareable?: boolean;
}
export declare class CollectionModel {
    static create(input: CreateCollectionInput, client?: PoolClient): Promise<Collection>;
    static findById(id: string): Promise<Collection | null>;
    static findByOwner(ownerId: string): Promise<Collection[]>;
    static update(id: string, updates: Partial<Collection>): Promise<Collection>;
    static delete(id: string): Promise<boolean>;
    static generateShareToken(id: string): Promise<Collection>;
    static findByShareToken(token: string): Promise<Collection | null>;
    static findPostedCollectionsByOwner(ownerId: string, limit?: number, offset?: number): Promise<Collection[]>;
}
//# sourceMappingURL=Collection.d.ts.map