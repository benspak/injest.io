interface DigestChannel {
    channelId: string;
    channelName: string | null;
    messageCount: number;
    summary: string;
}
interface UserDigest {
    userId: string;
    workspaceId: string;
    channels: DigestChannel[];
    totalMessages: number;
}
/**
 * Generate and send daily digests of missed Slack messages
 */
export declare class SlackDigestService {
    /**
     * Generate digest for a user
     */
    generateDigest(userId: string, workspaceId: string, date?: Date): Promise<UserDigest>;
    /**
     * Format digest as Slack message
     */
    formatDigestAsSlackMessage(digest: UserDigest): string;
    /**
     * Send digest to user via DM
     */
    sendDigest(userId: string, workspaceId: string, digest: UserDigest): Promise<void>;
    /**
     * Generate and send digest for all users with Slack connected
     */
    generateAndSendDigestsForAllUsers(date?: Date): Promise<void>;
}
export declare const slackDigestService: SlackDigestService;
export {};
//# sourceMappingURL=slackDigest.d.ts.map