export interface SlackChannel {
    id: string;
    workspace_id: string;
    channel_id: string;
    channel_name: string | null;
    channel_type: string | null;
    is_private: boolean;
    is_archived: boolean;
    created_at: Date;
    updated_at: Date;
}
export interface CreateSlackChannelInput {
    workspaceId: string;
    channelId: string;
    channelName?: string | null;
    channelType?: string | null;
    isPrivate?: boolean;
    isArchived?: boolean;
}
export interface UpdateSlackChannelInput {
    channelName?: string | null;
    channelType?: string | null;
    isPrivate?: boolean;
    isArchived?: boolean;
}
export declare class SlackChannelModel {
    static findByChannelId(workspaceId: string, channelId: string): Promise<SlackChannel | null>;
    static findByWorkspaceId(workspaceId: string): Promise<SlackChannel[]>;
    static findById(id: string): Promise<SlackChannel | null>;
    static create(input: CreateSlackChannelInput): Promise<SlackChannel>;
    static update(workspaceId: string, channelId: string, input: UpdateSlackChannelInput): Promise<SlackChannel>;
    static createOrUpdate(input: CreateSlackChannelInput): Promise<SlackChannel>;
    static delete(workspaceId: string, channelId: string): Promise<boolean>;
}
//# sourceMappingURL=SlackChannel.d.ts.map