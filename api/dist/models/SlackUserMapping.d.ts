export interface SlackUserMapping {
    id: string;
    user_id: string;
    workspace_id: string;
    slack_user_id: string;
    contact_id: string | null;
    slack_username: string | null;
    slack_email: string | null;
    created_at: Date;
    updated_at: Date;
}
export interface CreateSlackUserMappingInput {
    userId: string;
    workspaceId: string;
    slackUserId: string;
    contactId?: string | null;
    slackUsername?: string | null;
    slackEmail?: string | null;
}
export interface UpdateSlackUserMappingInput {
    contactId?: string | null;
    slackUsername?: string | null;
    slackEmail?: string | null;
}
export declare class SlackUserMappingModel {
    static findBySlackUserId(userId: string, workspaceId: string, slackUserId: string): Promise<SlackUserMapping | null>;
    static findByContactId(userId: string, contactId: string): Promise<SlackUserMapping[]>;
    static findByWorkspaceId(userId: string, workspaceId: string): Promise<SlackUserMapping[]>;
    static findById(id: string): Promise<SlackUserMapping | null>;
    static create(input: CreateSlackUserMappingInput): Promise<SlackUserMapping>;
    static update(userId: string, workspaceId: string, slackUserId: string, input: UpdateSlackUserMappingInput): Promise<SlackUserMapping>;
    static createOrUpdate(input: CreateSlackUserMappingInput): Promise<SlackUserMapping>;
    static delete(userId: string, workspaceId: string, slackUserId: string): Promise<boolean>;
}
//# sourceMappingURL=SlackUserMapping.d.ts.map