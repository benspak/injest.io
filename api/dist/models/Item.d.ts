import { PoolClient } from 'pg';
export interface AttachmentMetadata {
    filename: string;
    originalname?: string;
    mimetype?: string;
    size?: number;
    checksum?: string;
    [key: string]: any;
}
export interface Item {
    id: string;
    owner_id: string;
    type?: 'note' | 'link' | 'file' | 'email' | 'task';
    raw?: string;
    title?: string;
    description?: string;
    url?: string;
    attachments?: AttachmentMetadata[];
    clean?: string;
    tags?: string[];
    source?: string;
    embedding_id?: string;
    link_metadata?: any;
    notes?: string;
    posted_to_profile?: boolean;
    deleted_at?: Date | null;
    created_at: Date;
    updated_at: Date;
}
export interface CreateItemInput {
    owner_id: string;
    title?: string;
    description?: string;
    url?: string;
    attachments?: AttachmentMetadata[];
    notes?: string;
    tags?: string[];
    source?: string;
    clean?: string;
    type?: 'note' | 'link' | 'file' | 'email' | 'task';
    raw?: string;
    link_metadata?: any;
}
export declare class ItemModel {
    /**
     * Decrypt encrypted fields from database result
     * Handles both encrypted and unencrypted data (for migration compatibility)
     */
    static decryptItem(item: any): Item;
    static create(input: CreateItemInput, client?: PoolClient): Promise<Item>;
    static findById(id: string): Promise<Item | null>;
    static findByIdIncludingDeleted(id: string): Promise<Item | null>;
    static findByOwner(ownerId: string, limit?: number, offset?: number, filters?: {
        source?: string;
        hasAttachments?: boolean;
        fileType?: string;
    }): Promise<Item[]>;
    static countIndexedByOwner(ownerId: string, filters?: {
        source?: string;
        hasAttachments?: boolean;
        fileType?: string;
    }): Promise<number>;
    static findAllByOwner(ownerId: string): Promise<Item[]>;
    static findByAttachmentChecksum(ownerId: string, checksum: string, client?: PoolClient): Promise<Item | null>;
    static update(id: string, updates: Partial<Item>): Promise<Item>;
    static delete(id: string): Promise<boolean>;
    static findByResendEmailId(resendEmailId: string): Promise<Item | null>;
    static findByOwnerAndType(ownerId: string, type: string, limit?: number, offset?: number): Promise<Item[]>;
    static findPostedItemsByOwner(ownerId: string, limit?: number, offset?: number): Promise<Item[]>;
}
//# sourceMappingURL=Item.d.ts.map