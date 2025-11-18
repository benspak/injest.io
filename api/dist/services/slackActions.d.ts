interface ExtractResult {
    itemId: string;
    itemType: 'note' | 'task';
    itemTitle: string;
    itemUrl: string;
}
/**
 * Extract actions from Slack messages and convert to items/tasks
 */
export declare class SlackActionsService {
    /**
     * Extract a message to an item or task
     */
    extractToItem(workspaceId: string, channelId: string, messageTs: string, userId: string, options?: {
        type?: 'note' | 'task';
        force?: boolean;
    }): Promise<ExtractResult>;
    /**
     * Extract a message to a task specifically
     */
    extractToTask(workspaceId: string, channelId: string, messageTs: string, userId: string): Promise<ExtractResult>;
}
export declare const slackActionsService: SlackActionsService;
export {};
//# sourceMappingURL=slackActions.d.ts.map