export interface Item {
    id: string;
    owner_id: string;
    type?: 'note' | 'link' | 'file' | 'email' | 'task';
    raw?: string;
    title?: string;
    description?: string;
    url?: string;
    attachments?: any[];
    clean?: string;
    tags?: string[];
    source?: string;
    embedding_id?: string;
    link_metadata?: any;
    notes?: string;
    created_at: Date;
    updated_at: Date;
}
export interface CreateItemInput {
    owner_id: string;
    title?: string;
    description?: string;
    url?: string;
    attachments?: any[];
    notes?: string;
    tags?: string[];
    source?: string;
    clean?: string;
    type?: 'note' | 'link' | 'file' | 'email' | 'task';
    raw?: string;
    link_metadata?: any;
}
export declare class ItemModel {
    static create(input: CreateItemInput): Promise<Item>;
    static findById(id: string): Promise<Item | null>;
    static findByOwner(ownerId: string, limit?: number, offset?: number): Promise<Item[]>;
    static update(id: string, updates: Partial<Item>): Promise<Item>;
    static delete(id: string): Promise<boolean>;
}
//# sourceMappingURL=Item.d.ts.map