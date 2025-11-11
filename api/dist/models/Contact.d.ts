import type { Pool, PoolClient } from 'pg';
export interface Contact {
    id: string;
    owner_id: string;
    name: string | null;
    normalized_name: string;
    email: string | null;
    normalized_email: string;
    phone: string | null;
    normalized_phone: string;
    source_item_id: string | null;
    metadata: Record<string, unknown> | null;
    created_at: Date;
    updated_at: Date;
}
export interface UpsertContactInput {
    ownerId: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    sourceItemId?: string | null;
    metadata?: Record<string, unknown> | null;
}
export interface ListContactsOptions {
    limit?: number;
    offset?: number;
}
export interface UpdateContactInput {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    metadata?: Record<string, unknown> | null;
}
export declare class ContactModel {
    static upsert(input: UpsertContactInput, client?: Pool | PoolClient): Promise<Contact | null>;
    static upsertMany(inputs: UpsertContactInput[], client?: Pool | PoolClient): Promise<Contact[]>;
    static listByOwner(ownerId: string, options?: ListContactsOptions): Promise<Contact[]>;
    static findByOwnerAndId(ownerId: string, contactId: string, client?: Pool | PoolClient): Promise<Contact | null>;
    static update(ownerId: string, contactId: string, updates: UpdateContactInput, client?: Pool | PoolClient): Promise<Contact | null>;
    static delete(ownerId: string, contactId: string, client?: Pool | PoolClient): Promise<boolean>;
}
export declare const contactNormalizers: {
    email: (value?: string | null) => string;
    phone: (value?: string | null) => string;
    name: (value?: string | null) => string;
};
//# sourceMappingURL=Contact.d.ts.map