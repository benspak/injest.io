import { slackService } from './slack.js';
import { SlackMessageModel } from '../models/SlackMessage.js';
import { SlackChannelModel } from '../models/SlackChannel.js';
import { slackSummarizationService } from './slackSummarization.js';
/**
 * Generate and send daily digests of missed Slack messages
 */
export class SlackDigestService {
    /**
     * Generate digest for a user
     */
    async generateDigest(userId, workspaceId, date = new Date()) {
        // Get all channels for the workspace
        const channels = await SlackChannelModel.findByWorkspaceId(workspaceId);
        // Calculate date range (last 24 hours)
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        const startTs = (startDate.getTime() / 1000).toFixed(6);
        const endTs = (endDate.getTime() / 1000).toFixed(6);
        const digestChannels = [];
        let totalMessages = 0;
        // Process each channel
        for (const channel of channels) {
            if (channel.is_archived) {
                continue;
            }
            // Get messages in the date range
            const allMessages = await SlackMessageModel.findByChannel(workspaceId, channel.channel_id, 1000);
            const dateRangeMessages = allMessages.filter((msg) => {
                const msgTs = parseFloat(msg.message_ts);
                return msgTs >= parseFloat(startTs) && msgTs <= parseFloat(endTs);
            });
            if (dateRangeMessages.length === 0) {
                continue;
            }
            totalMessages += dateRangeMessages.length;
            // Generate summary for this channel
            try {
                const summaryResult = await slackSummarizationService.summarizeChannelSegment(channel.channel_id, workspaceId, userId, {
                    startTs,
                    endTs,
                });
                digestChannels.push({
                    channelId: channel.channel_id,
                    channelName: channel.channel_name,
                    messageCount: dateRangeMessages.length,
                    summary: summaryResult.summary,
                });
            }
            catch (error) {
                console.error(`[SlackDigest] Error summarizing channel ${channel.channel_id}:`, error);
                // Fallback: just count messages
                digestChannels.push({
                    channelId: channel.channel_id,
                    channelName: channel.channel_name,
                    messageCount: dateRangeMessages.length,
                    summary: `${dateRangeMessages.length} message${dateRangeMessages.length === 1 ? '' : 's'} in this channel.`,
                });
            }
        }
        return {
            userId,
            workspaceId,
            channels: digestChannels,
            totalMessages,
        };
    }
    /**
     * Format digest as Slack message
     */
    formatDigestAsSlackMessage(digest) {
        if (digest.channels.length === 0) {
            return 'No new messages in the last 24 hours.';
        }
        const lines = [];
        lines.push(`*Daily Slack Digest - ${new Date().toLocaleDateString()}*`);
        lines.push(`Total: ${digest.totalMessages} message${digest.totalMessages === 1 ? '' : 's'} across ${digest.channels.length} channel${digest.channels.length === 1 ? '' : 's'}\n`);
        for (const channel of digest.channels) {
            const channelName = channel.channelName ? `#${channel.channelName}` : 'Unknown Channel';
            lines.push(`*${channelName}* (${channel.messageCount} message${channel.messageCount === 1 ? '' : 's'})`);
            lines.push(channel.summary);
            lines.push('');
        }
        return lines.join('\n');
    }
    /**
     * Send digest to user via DM
     */
    async sendDigest(userId, workspaceId, digest) {
        const accessToken = await slackService.getValidAccessToken(userId);
        // Get user's DM channel ID
        // Note: This requires storing the user's Slack user ID, which we should do during OAuth
        // For now, we'll need to look it up or use a different approach
        // Format message
        const message = this.formatDigestAsSlackMessage(digest);
        // Post to user's DM
        // Note: We need the user's Slack user ID to open a DM channel
        // This is a simplified version - in production, you'd need to:
        // 1. Store the user's Slack user ID during OAuth
        // 2. Use conversations.open to get/create a DM channel
        // 3. Post the message to that channel
        console.log(`[SlackDigest] Would send digest to user ${userId}:`, message.substring(0, 200));
        // TODO: Implement actual DM sending
    }
    /**
     * Generate and send digest for all users with Slack connected
     */
    async generateAndSendDigestsForAllUsers(date = new Date()) {
        // Get all Slack tokens (all users with Slack connected)
        // Note: We'd need a method to get all tokens, or iterate through users
        // For now, this is a placeholder that shows the structure
        console.log(`[SlackDigest] Generating digests for date: ${date.toISOString()}`);
        // This would iterate through all users with Slack tokens
        // For each user:
        // 1. Get their workspaces
        // 2. Generate digest for each workspace
        // 3. Send digest via DM
        // Implementation would require:
        // - Method to get all Slack tokens
        // - Method to get user's Slack user ID
        // - Method to open/create DM channel
        // - Method to post message to DM
    }
}
export const slackDigestService = new SlackDigestService();
//# sourceMappingURL=slackDigest.js.map