export interface XcomOAuthToken {
    id: string;
    user_id: string;
    access_token: string;
    refresh_token: string | null;
    token_type: string;
    expires_at: Date | null;
    scope: string | null;
    x_user_id: string | null;
    x_username: string | null;
    created_at: Date;
    updated_at: Date;
}
export interface CreateXcomOAuthTokenInput {
    userId: string;
    accessToken: string;
    refreshToken?: string | null;
    tokenType?: string;
    expiresAt?: Date | null;
    scope?: string | null;
    xUserId?: string | null;
    xUsername?: string | null;
}
export interface UpdateXcomOAuthTokenInput {
    accessToken?: string;
    refreshToken?: string | null;
    tokenType?: string;
    expiresAt?: Date | null;
    scope?: string | null;
    xUserId?: string | null;
    xUsername?: string | null;
}
export declare class XcomOAuthTokenModel {
    static findByUserId(userId: string): Promise<XcomOAuthToken | null>;
    static findById(id: string): Promise<XcomOAuthToken | null>;
    static create(input: CreateXcomOAuthTokenInput): Promise<XcomOAuthToken>;
    static update(userId: string, input: UpdateXcomOAuthTokenInput): Promise<XcomOAuthToken>;
    static createOrUpdate(userId: string, input: CreateXcomOAuthTokenInput): Promise<XcomOAuthToken>;
    static delete(userId: string): Promise<boolean>;
    static isTokenValid(token: XcomOAuthToken): Promise<boolean>;
    static findByXUserId(xUserId: string): Promise<XcomOAuthToken | null>;
}
//# sourceMappingURL=XcomOAuthToken.d.ts.map