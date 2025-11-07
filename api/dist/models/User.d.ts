export interface User {
    id: string;
    email: string;
    verified: boolean;
    is_premium?: boolean;
    stripe_customer_id?: string;
    bookmark_import_count?: number;
    last_bookmark_import_payment?: Date;
    xcom_access_token?: string;
    xcom_refresh_token?: string;
    xcom_token_expires_at?: Date;
    xcom_user_id?: string;
    xcom_username?: string;
    created_at: Date;
    updated_at: Date;
}
export interface XComTokens {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    user_id?: string;
    username?: string;
}
export declare class UserModel {
    static findByEmail(email: string): Promise<User | null>;
    static findById(id: string): Promise<User | null>;
    static create(email: string): Promise<User>;
    static verifyEmail(id: string): Promise<User>;
    static update(id: string, updates: Partial<User>): Promise<User>;
    /**
     * Update X.com OAuth tokens for a user
     */
    static updateXComTokens(userId: string, tokens: XComTokens): Promise<User>;
    /**
     * Get X.com tokens for a user
     */
    static getXComTokens(userId: string): Promise<{
        access_token: string;
        refresh_token?: string;
        expires_at?: Date;
        user_id?: string;
        username?: string;
    } | null>;
    /**
     * Clear X.com tokens (disconnect)
     */
    static clearXComTokens(userId: string): Promise<User>;
}
//# sourceMappingURL=User.d.ts.map