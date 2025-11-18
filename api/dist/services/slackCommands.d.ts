interface SlackCommandPayload {
    token: string;
    team_id: string;
    team_domain: string;
    channel_id: string;
    channel_name: string;
    user_id: string;
    user_name: string;
    command: string;
    text: string;
    response_url: string;
    trigger_id: string;
}
interface SlackBlock {
    type: string;
    [key: string]: any;
}
interface SlackMessageResponse {
    response_type?: 'in_channel' | 'ephemeral';
    text?: string;
    blocks?: SlackBlock[];
}
export declare class SlackCommandsService {
    /**
     * Handle slash command
     */
    handleCommand(payload: SlackCommandPayload): Promise<SlackMessageResponse>;
    /**
     * Handle /injest search command
     */
    private handleSearchCommand;
    /**
     * Handle /injest summarize command
     */
    private handleSummarizeCommand;
    /**
     * Handle /injest save command
     */
    private handleSaveCommand;
    /**
     * Handle /injest help command
     */
    private handleHelpCommand;
}
export declare const slackCommandsService: SlackCommandsService;
export {};
//# sourceMappingURL=slackCommands.d.ts.map