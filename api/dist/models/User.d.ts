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
    two_factor_enabled?: boolean;
    two_factor_secret?: string | null;
    two_factor_confirmed_at?: Date | null;
    two_factor_recovery_codes?: string[] | null;
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
    static saveTwoFactorSecret(userId: string, secret: string | null): Promise<User>;
    static enableTwoFactor(userId: string, secret: string, recoveryCodes: string[]): Promise<User>;
    static disableTwoFactor(userId: string): Promise<User>;
    static updateRecoveryCodes(userId: string, recoveryCodes: string[] | null): Promise<User>;
}
//# sourceMappingURL=User.d.ts.map