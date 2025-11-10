import type { SubscriptionTier } from '../utils/subscriptionPlans.js';
export interface User {
    id: string;
    email: string;
    verified: boolean;
    is_premium?: boolean;
    subscription_tier?: SubscriptionTier;
    stripe_customer_id?: string;
    bookmark_import_count?: number;
    last_bookmark_import_payment?: Date;
    api_key_hash?: string | null;
    api_key_created_at?: Date | null;
    api_key_last_used_at?: Date | null;
    created_at: Date;
    updated_at: Date;
}
export declare class UserModel {
    static findByEmail(email: string): Promise<User | null>;
    static findById(id: string): Promise<User | null>;
    static create(email: string): Promise<User>;
    static verifyEmail(id: string): Promise<User>;
    static update(id: string, updates: Partial<User>): Promise<User>;
    static setApiKey(userId: string, apiKeyHash: string): Promise<User>;
    static clearApiKey(userId: string): Promise<User>;
    static updateApiKeyLastUsed(userId: string): Promise<void>;
    static findByApiKeyHash(apiKeyHash: string): Promise<User | null>;
}
//# sourceMappingURL=User.d.ts.map