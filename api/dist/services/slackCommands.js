import { slackSearchService } from './slackSearch.js';
import { SlackOAuthTokenModel } from '../models/SlackOAuthToken.js';
import { slackSummarizationService } from './slackSummarization.js';
import { slackActionsService } from './slackActions.js';
const SLACK_API_BASE_URL = 'https://slack.com/api';
/**
 * Format search results as Slack Block Kit blocks
 */
function formatSearchResults(results) {
    if (results.length === 0) {
        return [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: 'No messages found matching your query.',
                },
            },
        ];
    }
    const blocks = [
        {
            type: 'header',
            text: {
                type: 'plain_text',
                text: `Found ${results.length} message${results.length === 1 ? '' : 's'}`,
            },
        },
        {
            type: 'divider',
        },
    ];
    for (const result of results.slice(0, 10)) {
        // Build message preview
        const messageText = result.slackMessage.text || result.item.description || 'No text';
        const preview = messageText.length > 200 ? messageText.substring(0, 200) + '...' : messageText;
        const channelName = result.channel?.channel_name || 'unknown';
        const channelContext = `#${channelName}`;
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*${channelContext}*\n${preview}`,
            },
            accessory: result.permalink
                ? {
                    type: 'button',
                    text: {
                        type: 'plain_text',
                        text: 'View',
                    },
                    url: result.permalink,
                }
                : undefined,
        });
        if (result.permalink) {
            blocks.push({
                type: 'context',
                elements: [
                    {
                        type: 'mrkdwn',
                        text: `<${result.permalink}|View message> • Similarity: ${(result.similarity * 100).toFixed(0)}%`,
                    },
                ],
            });
        }
        blocks.push({
            type: 'divider',
        });
    }
    return blocks;
}
/**
 * Format summary as Slack Block Kit blocks
 */
function formatSummary(summary, messageCount) {
    return [
        {
            type: 'header',
            text: {
                type: 'plain_text',
                text: `Summary (${messageCount} message${messageCount === 1 ? '' : 's'})`,
            },
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: summary,
            },
        },
    ];
}
export class SlackCommandsService {
    /**
     * Handle slash command
     */
    async handleCommand(payload) {
        const { command, text, team_id, channel_id, user_id } = payload;
        // Find user by workspace ID
        const tokens = await SlackOAuthTokenModel.findByWorkspaceId(team_id);
        if (tokens.length === 0) {
            return {
                response_type: 'ephemeral',
                text: 'Slack workspace not connected. Please connect your workspace first.',
            };
        }
        const userId = tokens[0].user_id;
        const workspaceId = team_id;
        // Parse command
        const parts = text.trim().split(/\s+/);
        const subcommand = parts[0]?.toLowerCase();
        const args = parts.slice(1).join(' ');
        switch (subcommand) {
            case 'search':
                return this.handleSearchCommand(userId, workspaceId, channel_id, args);
            case 'summarize':
                return this.handleSummarizeCommand(userId, workspaceId, channel_id, args);
            case 'save':
                return this.handleSaveCommand(userId, workspaceId, channel_id, args);
            case 'help':
            default:
                return this.handleHelpCommand();
        }
    }
    /**
     * Handle /injest search command
     */
    async handleSearchCommand(userId, workspaceId, channelId, query) {
        if (!query) {
            return {
                response_type: 'ephemeral',
                text: 'Usage: `/injest search <query>` - Search across all Slack messages',
            };
        }
        try {
            const results = await slackSearchService.searchMessages(userId, query, {
                workspaceId,
                limit: 10,
            });
            return {
                response_type: 'ephemeral',
                blocks: formatSearchResults(results),
            };
        }
        catch (error) {
            console.error('[SlackCommands] Error searching:', error);
            return {
                response_type: 'ephemeral',
                text: 'Error searching messages. Please try again later.',
            };
        }
    }
    /**
     * Handle /injest summarize command
     */
    async handleSummarizeCommand(userId, workspaceId, channelId, args) {
        try {
            // If args contains a timestamp, summarize that thread
            // Otherwise, summarize recent messages in the channel
            let summary;
            let messageCount;
            if (args) {
                // Try to parse as thread timestamp
                const threadTs = args.trim();
                const result = await slackSummarizationService.summarizeThread(threadTs, channelId, workspaceId, userId);
                summary = result.summary;
                messageCount = result.messageCount;
            }
            else {
                // Summarize recent channel messages
                const result = await slackSummarizationService.summarizeChannelSegment(channelId, workspaceId, userId, {
                    hours: 24, // Last 24 hours
                });
                summary = result.summary;
                messageCount = result.messageCount;
            }
            return {
                response_type: 'ephemeral',
                blocks: formatSummary(summary, messageCount),
            };
        }
        catch (error) {
            console.error('[SlackCommands] Error summarizing:', error);
            return {
                response_type: 'ephemeral',
                text: 'Error generating summary. Please try again later.',
            };
        }
    }
    /**
     * Handle /injest save command
     */
    async handleSaveCommand(userId, workspaceId, channelId, args) {
        if (!args) {
            return {
                response_type: 'ephemeral',
                text: 'Usage: `/injest save <message_timestamp>` - Convert a message to a knowledge item',
            };
        }
        try {
            const messageTs = args.trim();
            const result = await slackActionsService.extractToItem(workspaceId, channelId, messageTs, userId);
            return {
                response_type: 'ephemeral',
                text: `Message saved as ${result.itemType}: ${result.itemTitle}\n<${result.itemUrl}|View item>`,
            };
        }
        catch (error) {
            console.error('[SlackCommands] Error saving message:', error);
            return {
                response_type: 'ephemeral',
                text: 'Error saving message. Please try again later.',
            };
        }
    }
    /**
     * Handle /injest help command
     */
    handleHelpCommand() {
        return {
            response_type: 'ephemeral',
            blocks: [
                {
                    type: 'header',
                    text: {
                        type: 'plain_text',
                        text: 'Injest Slack Commands',
                    },
                },
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: '*Available commands:*\n\n`/injest search <query>` - Search across all Slack messages\n`/injest summarize [thread_ts]` - Summarize a thread or recent channel messages\n`/injest save <message_ts>` - Convert a message to a knowledge item\n`/injest help` - Show this help message',
                    },
                },
            ],
        };
    }
}
export const slackCommandsService = new SlackCommandsService();
//# sourceMappingURL=slackCommands.js.map