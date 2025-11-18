interface SlackEvent {
    type: string;
    subtype?: string;
    event_ts?: string;
    ts?: string;
    user?: string;
    text?: string;
    channel?: string;
    channel_type?: string;
    thread_ts?: string;
    files?: Array<{
        id: string;
        name: string;
        mimetype?: string;
        size?: number;
        url_private?: string;
    }>;
    reaction?: string;
    item?: {
        type: string;
        channel?: string;
        ts?: string;
    };
}
/**
 * Handle Slack Events API webhook
 */
export declare class SlackWebhookService {
    /**
     * Verify webhook request signature and timestamp
     */
    verifyRequest(timestamp: string, signature: string, body: string): boolean;
    /**
     * Handle URL verification challenge
     */
    handleUrlVerification(challenge: string): {
        challenge: string;
    };
    /**
     * Process a Slack event
     */
    processEvent(event: SlackEvent, teamId: string): Promise<void>;
    /**
     * Handle message events
     */
    private handleMessageEvent;
    /**
     * Handle reaction events
     */
    private handleReactionEvent;
    /**
     * Handle file shared events
     */
    private handleFileEvent;
}
export declare const slackWebhookService: SlackWebhookService;
export {};
//# sourceMappingURL=slackWebhooks.d.ts.map