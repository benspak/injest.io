interface SummarizeResult {
    summary: string;
    messageCount: number;
}
interface SummarizeOptions {
    hours?: number;
    startTs?: string;
    endTs?: string;
}
/**
 * Summarize Slack threads and channel segments using OpenAI
 */
export declare class SlackSummarizationService {
    /**
     * Summarize a thread
     */
    summarizeThread(threadTs: string, channelId: string, workspaceId: string, userId: string): Promise<SummarizeResult>;
    /**
     * Summarize a channel segment (time range)
     */
    summarizeChannelSegment(channelId: string, workspaceId: string, userId: string, options?: SummarizeOptions): Promise<SummarizeResult>;
}
export declare const slackSummarizationService: SlackSummarizationService;
export {};
//# sourceMappingURL=slackSummarization.d.ts.map