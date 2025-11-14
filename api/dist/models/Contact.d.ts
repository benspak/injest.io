import type { Pool, PoolClient } from 'pg';
export interface Contact {
    id: string;
    owner_id: string;
    name: string | null;
    normalized_name: string;
    first_name: string | null;
    last_name: string | null;
    normalized_first_name: string;
    normalized_last_name: string;
    email: string | null;
    normalized_email: string;
    phone: string | null;
    normalized_phone: string;
    linkedin_url: string | null;
    x_url: string | null;
    github_url: string | null;
    source_item_id: string | null;
    matched_user_id: string | null;
    metadata: Record<string, unknown> | null;
    created_at: Date;
    updated_at: Date;
}
export interface UpsertContactInput {
    ownerId: string;
    firstName?: string | null;
    lastName?: string | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    linkedinUrl?: string | null;
    xUrl?: string | null;
    githubUrl?: string | null;
    sourceItemId?: string | null;
    matchedUserId?: string | null;
    metadata?: Record<string, unknown> | null;
}
export interface ListContactsOptions {
    limit?: number;
    offset?: number;
    search?: string | null;
}
export interface UpdateContactInput {
    firstName?: string | null;
    lastName?: string | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    linkedinUrl?: string | null;
    xUrl?: string | null;
    githubUrl?: string | null;
    matchedUserId?: string | null;
    metadata?: Record<string, unknown> | null;
}
export declare class ContactModel {
    static upsert(input: UpsertContactInput, client?: Pool | PoolClient): Promise<Contact | null>;
    static upsertMany(inputs: UpsertContactInput[], client?: Pool | PoolClient): Promise<Contact[]>;
    static listByOwner(ownerId: string, options?: ListContactsOptions): Promise<Contact[]>;
    static countByOwner(ownerId: string, options?: {
        search?: string | null;
    }): Promise<number>;
    static findByOwnerAndId(ownerId: string, contactId: string, client?: Pool | PoolClient): Promise<Contact | null>;
    static findById(contactId: string): Promise<Contact | null>;
    static update(ownerId: string, contactId: string, updates: UpdateContactInput, client?: Pool | PoolClient): Promise<Contact | null>;
    static delete(ownerId: string, contactId: string, client?: Pool | PoolClient): Promise<boolean>;
    private static normalizeDomain;
    static searchForSend(ownerId: string, options?: {
        domain?: string | null;
        keywords?: string[] | null;
        limit?: number;
        excludeIds?: string[] | null;
    }): Promise<Contact[]>;
}
export declare const contactNormalizers: {
    email: (value?: string | null) => string;
    phone: (value?: string | null) => string;
    name: (value?: string | null) => string;
};
//# sourceMappingURL=Contact.d.ts.map