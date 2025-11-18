export interface SlackMessage {
    id: string;
    workspace_id: string;
    channel_id: string;
    message_ts: string;
    thread_ts: string | null;
    slack_user_id: string;
    text: string | null;
    item_id: string | null;
    indexed_at: Date | null;
    created_at: Date;
    updated_at: Date;
}
export interface CreateSlackMessageInput {
    workspaceId: string;
    channelId: string;
    messageTs: string;
    threadTs?: string | null;
    slackUserId: string;
    text?: string | null;
    itemId?: string | null;
}
export interface UpdateSlackMessageInput {
    text?: string | null;
    itemId?: string | null;
    indexedAt?: Date | null;
}
export declare class SlackMessageModel {
    static findByMessageTs(workspaceId: string, channelId: string, messageTs: string): Promise<SlackMessage | null>;
    static findByItemId(itemId: string): Promise<SlackMessage | null>;
    static findByChannel(workspaceId: string, channelId: string, limit?: number): Promise<SlackMessage[]>;
    static findByThread(workspaceId: string, channelId: string, threadTs: string): Promise<SlackMessage[]>;
    static findBySlackUserId(workspaceId: string, slackUserId: string, limit?: number): Promise<SlackMessage[]>;
    static findUnindexed(workspaceId: string, limit?: number): Promise<SlackMessage[]>;
    static create(input: CreateSlackMessageInput): Promise<SlackMessage>;
    static update(workspaceId: string, channelId: string, messageTs: string, input: UpdateSlackMessageInput): Promise<SlackMessage>;
    static createOrUpdate(input: CreateSlackMessageInput): Promise<SlackMessage>;
    static delete(workspaceId: string, channelId: string, messageTs: string): Promise<boolean>;
}
//# sourceMappingURL=SlackMessage.d.ts.map