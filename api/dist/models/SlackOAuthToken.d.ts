export interface SlackOAuthToken {
    id: string;
    user_id: string;
    workspace_id: string;
    access_token: string;
    bot_user_id: string | null;
    scope: string | null;
    authed_user_id: string | null;
    authed_user_token: string | null;
    created_at: Date;
    updated_at: Date;
}
export interface CreateSlackOAuthTokenInput {
    userId: string;
    workspaceId: string;
    accessToken: string;
    botUserId?: string | null;
    scope?: string | null;
    authedUserId?: string | null;
    authedUserToken?: string | null;
}
export interface UpdateSlackOAuthTokenInput {
    accessToken?: string;
    botUserId?: string | null;
    scope?: string | null;
    authedUserId?: string | null;
    authedUserToken?: string | null;
}
export declare class SlackOAuthTokenModel {
    static findByUserId(userId: string): Promise<SlackOAuthToken | null>;
    static findAllByUserId(userId: string): Promise<SlackOAuthToken[]>;
    static findByUserIdAndWorkspace(userId: string, workspaceId: string): Promise<SlackOAuthToken | null>;
    static findByWorkspaceId(workspaceId: string): Promise<SlackOAuthToken[]>;
    static findById(id: string): Promise<SlackOAuthToken | null>;
    static create(input: CreateSlackOAuthTokenInput): Promise<SlackOAuthToken>;
    static update(userId: string, workspaceId: string, input: UpdateSlackOAuthTokenInput): Promise<SlackOAuthToken>;
    static createOrUpdate(userId: string, input: CreateSlackOAuthTokenInput): Promise<SlackOAuthToken>;
    static delete(userId: string): Promise<boolean>;
    static deleteByWorkspace(userId: string, workspaceId: string): Promise<boolean>;
}
//# sourceMappingURL=SlackOAuthToken.d.ts.map