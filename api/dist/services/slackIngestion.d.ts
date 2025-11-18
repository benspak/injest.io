interface SlackMessage {
    ts: string;
    user: string;
    text: string;
    thread_ts?: string;
    files?: Array<{
        id: string;
        name: string;
        mimetype?: string;
        size?: number;
        url_private?: string;
        thumb_64?: string;
    }>;
    reactions?: Array<{
        name: string;
        users: string[];
    }>;
}
export declare class SlackIngestionService {
    /**
     * Ingest a single message and create an item
     */
    ingestMessage(message: SlackMessage, workspaceId: string, channelId: string, channelName: string | null, userId: string): Promise<{
        itemId: string | null;
        messageId: string;
    }>;
    /**
     * Ingest a channel's messages
     */
    ingestChannel(channelId: string, workspaceId: string, userId: string, options?: {
        limit?: number;
        oldest?: string;
    }): Promise<{
        ingested: number;
        errors: number;
    }>;
    /**
     * Ingest a thread's replies
     */
    ingestThread(threadTs: string, channelId: string, workspaceId: string, userId: string): Promise<{
        ingested: number;
        errors: number;
    }>;
    /**
     * Ingest all channels for a workspace
     */
    ingestWorkspace(workspaceId: string, userId: string): Promise<{
        channels: number;
        messages: number;
        errors: number;
    }>;
}
export declare const slackIngestionService: SlackIngestionService;
export {};
//# sourceMappingURL=slackIngestion.d.ts.map