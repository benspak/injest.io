interface SlackSearchResult {
    item: {
        id: string;
        title: string | null;
        description: string | null;
        source: string | null;
        tags: string[] | null;
        created_at: Date;
    };
    slackMessage: {
        id: string;
        workspace_id: string;
        channel_id: string;
        message_ts: string;
        thread_ts: string | null;
        slack_user_id: string;
        text: string | null;
    };
    channel: {
        id: string;
        channel_name: string | null;
        channel_type: string | null;
    } | null;
    similarity: number;
    permalink: string | null;
}
interface SlackSearchOptions {
    channelId?: string;
    workspaceId?: string;
    limit?: number;
    minSimilarity?: number;
}
export declare class SlackSearchService {
    /**
     * Search Slack messages semantically
     */
    searchMessages(userId: string, query: string, options?: SlackSearchOptions): Promise<SlackSearchResult[]>;
    /**
     * Search messages in a specific channel
     */
    searchChannel(userId: string, channelId: string, workspaceId: string, query: string, options?: {
        limit?: number;
        minSimilarity?: number;
    }): Promise<SlackSearchResult[]>;
    /**
     * Get message context (thread messages)
     */
    getMessageContext(userId: string, workspaceId: string, channelId: string, messageTs: string): Promise<{
        message: SlackSearchResult | null;
        thread: SlackSearchResult[];
    }>;
}
export declare const slackSearchService: SlackSearchService;
export {};
//# sourceMappingURL=slackSearch.d.ts.map