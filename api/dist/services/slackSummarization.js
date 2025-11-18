import { openAIService } from './openai.js';
import { SlackMessageModel } from '../models/SlackMessage.js';
import { SlackChannelModel } from '../models/SlackChannel.js';
import { ItemModel } from '../models/Item.js';
/**
 * Summarize Slack threads and channel segments using OpenAI
 */
export class SlackSummarizationService {
    /**
     * Summarize a thread
     */
    async summarizeThread(threadTs, channelId, workspaceId, userId) {
        // Get all messages in the thread
        const messages = await SlackMessageModel.findByThread(workspaceId, channelId, threadTs);
        if (messages.length === 0) {
            throw new Error('Thread not found');
        }
        // Get channel info
        const channel = await SlackChannelModel.findByChannelId(workspaceId, channelId);
        const channelName = channel?.channel_name || 'unknown';
        // Build context from messages
        const messageTexts = [];
        for (const msg of messages) {
            if (msg.item_id) {
                const item = await ItemModel.findById(msg.item_id);
                if (item && item.description) {
                    messageTexts.push(item.description);
                }
                else if (msg.text) {
                    messageTexts.push(msg.text);
                }
            }
            else if (msg.text) {
                messageTexts.push(msg.text);
            }
        }
        if (messageTexts.length === 0) {
            return {
                summary: 'No messages found in thread.',
                messageCount: 0,
            };
        }
        const context = messageTexts.join('\n\n');
        const prompt = `Summarize the following Slack thread from #${channelName}. Provide a concise summary of the key points and decisions made:\n\n${context}`;
        try {
            const summary = await openAIService.generate(prompt);
            return {
                summary: summary || 'Unable to generate summary.',
                messageCount: messages.length,
            };
        }
        catch (error) {
            console.error('[SlackSummarization] Error generating summary:', error);
            throw new Error('Failed to generate summary');
        }
    }
    /**
     * Summarize a channel segment (time range)
     */
    async summarizeChannelSegment(channelId, workspaceId, userId, options = {}) {
        const { hours = 24, startTs, endTs } = options;
        // Calculate time range
        let oldest;
        let latest;
        if (startTs && endTs) {
            oldest = startTs;
            latest = endTs;
        }
        else if (hours) {
            const now = Date.now();
            const hoursAgo = now - hours * 60 * 60 * 1000;
            oldest = (hoursAgo / 1000).toFixed(6);
            latest = (now / 1000).toFixed(6);
        }
        // Get messages in time range
        const allMessages = await SlackMessageModel.findByChannel(workspaceId, channelId, 1000);
        const messages = allMessages.filter((msg) => {
            const msgTs = parseFloat(msg.message_ts);
            if (oldest && msgTs < parseFloat(oldest)) {
                return false;
            }
            if (latest && msgTs > parseFloat(latest)) {
                return false;
            }
            return true;
        });
        if (messages.length === 0) {
            return {
                summary: 'No messages found in the specified time range.',
                messageCount: 0,
            };
        }
        // Get channel info
        const channel = await SlackChannelModel.findByChannelId(workspaceId, channelId);
        const channelName = channel?.channel_name || 'unknown';
        // Build context from messages
        const messageTexts = [];
        for (const msg of messages.slice(0, 100)) {
            // Limit to 100 messages to avoid token limits
            if (msg.item_id) {
                const item = await ItemModel.findById(msg.item_id);
                if (item && item.description) {
                    messageTexts.push(item.description);
                }
                else if (msg.text) {
                    messageTexts.push(msg.text);
                }
            }
            else if (msg.text) {
                messageTexts.push(msg.text);
            }
        }
        if (messageTexts.length === 0) {
            return {
                summary: 'No message content found.',
                messageCount: messages.length,
            };
        }
        const context = messageTexts.join('\n\n');
        const timeRange = hours ? `last ${hours} hour${hours === 1 ? '' : 's'}` : 'specified time range';
        const prompt = `Summarize the following Slack messages from #${channelName} (${timeRange}). Provide a concise summary of the key topics, decisions, and action items:\n\n${context}`;
        try {
            const summary = await openAIService.generate(prompt);
            return {
                summary: summary || 'Unable to generate summary.',
                messageCount: messages.length,
            };
        }
        catch (error) {
            console.error('[SlackSummarization] Error generating summary:', error);
            throw new Error('Failed to generate summary');
        }
    }
}
export const slackSummarizationService = new SlackSummarizationService();
//# sourceMappingURL=slackSummarization.js.map