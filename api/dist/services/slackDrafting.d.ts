interface DraftReplyOptions {
    contextMessages?: number;
    tone?: 'professional' | 'casual' | 'friendly';
}
interface PostMessageOptions {
    threadTs?: string;
}
/**
 * Draft and post AI-generated replies to Slack
 */
export declare class SlackDraftingService {
    /**
     * Draft a reply to a message or thread
     */
    draftReply(channelId: string, workspaceId: string, userId: string, threadTs: string | null, context: string, options?: DraftReplyOptions): Promise<string>;
    /**
     * Draft a new message (not a reply)
     */
    draftMessage(channelId: string, workspaceId: string, userId: string, context: string, options?: DraftReplyOptions): Promise<string>;
    /**
     * Post a message to Slack
     */
    postMessage(channelId: string, workspaceId: string, userId: string, text: string, options?: PostMessageOptions): Promise<{
        ts: string;
        channel: string;
    }>;
    /**
     * Draft and post a reply in one step
     */
    draftAndPostReply(channelId: string, workspaceId: string, userId: string, threadTs: string, context: string, options?: DraftReplyOptions & PostMessageOptions): Promise<{
        ts: string;
        channel: string;
        draft: string;
    }>;
}
export declare const slackDraftingService: SlackDraftingService;
export {};
//# sourceMappingURL=slackDrafting.d.ts.map