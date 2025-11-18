import { slackService } from './slack.js';
import { SlackWorkspaceModel } from '../models/SlackWorkspace.js';
import { SlackChannelModel } from '../models/SlackChannel.js';
import { SlackMessageModel } from '../models/SlackMessage.js';
import { ItemModel } from '../models/Item.js';
import { indexingService } from './indexing.js';
const SLACK_API_BASE_URL = 'https://slack.com/api';
/**
 * Normalize Slack message text by removing formatting and extracting mentions
 */
function normalizeMessageText(text) {
    if (!text) {
        return '';
    }
    // Remove Slack user mentions (<@U123456>)
    let normalized = text.replace(/<@([A-Z0-9]+)>/g, '@user');
    // Remove channel mentions (<#C123456|channel-name>)
    normalized = normalized.replace(/<#([A-Z0-9]+)(?:\|[^>]+)?>/g, '#channel');
    // Remove links but keep text (<https://example.com|link text>)
    normalized = normalized.replace(/<https?:\/\/[^|>]+(?:\|[^>]+)?>/g, (match) => {
        const urlMatch = match.match(/<([^|>]+)/);
        return urlMatch ? urlMatch[1] : match;
    });
    // Remove other Slack formatting (<!here>, <!channel>, etc.)
    normalized = normalized.replace(/<![A-Z0-9]+>/g, '');
    // Clean up extra whitespace
    normalized = normalized.replace(/\s+/g, ' ').trim();
    return normalized;
}
/**
 * Get channel type from Slack channel object
 */
function getChannelType(channel) {
    if (channel.is_im)
        return 'im';
    if (channel.is_mpim)
        return 'mpim';
    if (channel.is_group)
        return 'group';
    if (channel.is_channel)
        return 'channel';
    return 'unknown';
}
/**
 * Fetch channels user has access to
 */
async function fetchChannels(accessToken) {
    const allChannels = [];
    let cursor;
    // Fetch public channels
    do {
        const params = new URLSearchParams({
            types: 'public_channel,private_channel,mpim,im',
            exclude_archived: 'true',
            limit: '200',
        });
        if (cursor) {
            params.append('cursor', cursor);
        }
        const response = await fetch(`${SLACK_API_BASE_URL}/conversations.list?${params.toString()}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch channels: ${response.statusText}`);
        }
        const data = (await response.json());
        if (!data.ok) {
            throw new Error(`Slack API error: ${data.error || 'Unknown error'}`);
        }
        if (data.channels) {
            allChannels.push(...data.channels);
        }
        cursor = data.response_metadata?.next_cursor;
    } while (cursor);
    return allChannels;
}
/**
 * Join a channel with bot token
 */
async function joinChannel(accessToken, channelId) {
    try {
        const response = await fetch(`${SLACK_API_BASE_URL}/conversations.join`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Bearer ${accessToken}`,
            },
            body: new URLSearchParams({
                channel: channelId,
            }),
        });
        if (!response.ok) {
            return false;
        }
        const data = (await response.json());
        return data.ok || false;
    }
    catch (error) {
        console.warn(`[SlackIngestion] Error joining channel ${channelId}:`, error);
        return false;
    }
}
/**
 * Fetch messages from a channel with pagination
 */
async function fetchChannelMessages(accessToken, channelId, oldest, limit = 200) {
    const params = new URLSearchParams({
        channel: channelId,
        limit: limit.toString(),
    });
    if (oldest) {
        params.append('oldest', oldest);
    }
    const response = await fetch(`${SLACK_API_BASE_URL}/conversations.history?${params.toString()}`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.statusText}`);
    }
    const data = (await response.json());
    if (!data.ok) {
        throw new Error(`Slack API error: ${data.error || 'Unknown error'}`);
    }
    return {
        messages: data.messages || [],
        hasMore: data.has_more || false,
        nextCursor: data.response_metadata?.next_cursor,
    };
}
/**
 * Fetch thread replies
 */
async function fetchThreadReplies(accessToken, channelId, threadTs, limit = 200) {
    const params = new URLSearchParams({
        channel: channelId,
        ts: threadTs,
        limit: limit.toString(),
    });
    const response = await fetch(`${SLACK_API_BASE_URL}/conversations.replies?${params.toString()}`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch thread replies: ${response.statusText}`);
    }
    const data = (await response.json());
    if (!data.ok) {
        throw new Error(`Slack API error: ${data.error || 'Unknown error'}`);
    }
    return {
        messages: data.messages || [],
        hasMore: data.has_more || false,
        nextCursor: data.response_metadata?.next_cursor,
    };
}
/**
 * Sleep helper for rate limiting
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export class SlackIngestionService {
    /**
     * Ingest a single message and create an item
     */
    async ingestMessage(message, workspaceId, channelId, channelName, userId) {
        const normalizedText = normalizeMessageText(message.text);
        if (!normalizedText && !message.files?.length) {
            // Skip empty messages without files
            const slackMessage = await SlackMessageModel.createOrUpdate({
                workspaceId,
                channelId,
                messageTs: message.ts,
                threadTs: message.thread_ts || null,
                slackUserId: message.user,
                text: message.text || null,
            });
            return { itemId: null, messageId: slackMessage.id };
        }
        // Build title from message text (first 100 chars)
        const title = normalizedText.length > 100 ? normalizedText.substring(0, 100) + '...' : normalizedText;
        // Build description with channel context
        const channelContext = channelName ? `#${channelName}` : 'Slack';
        const description = normalizedText || 'Slack message';
        // Create item
        const item = await ItemModel.create({
            owner_id: userId,
            type: 'note',
            title,
            description,
            source: `slack:${workspaceId}:${channelId}`,
            tags: ['slack', channelName || 'slack'].filter(Boolean),
            notes: message.thread_ts
                ? `Thread: ${message.thread_ts}\nMessage: ${message.ts}`
                : `Message: ${message.ts}`,
        });
        // Store Slack message with link to item
        const slackMessage = await SlackMessageModel.createOrUpdate({
            workspaceId,
            channelId,
            messageTs: message.ts,
            threadTs: message.thread_ts || null,
            slackUserId: message.user,
            text: message.text || null,
            itemId: item.id,
        });
        // Index the item
        await indexingService.indexItem(item.id);
        // Mark as indexed
        await SlackMessageModel.update(workspaceId, channelId, message.ts, {
            indexedAt: new Date(),
        });
        // Store reactions if present
        if (message.reactions) {
            // Note: We'll create a separate service for reactions if needed
            // For now, we'll just store them in the message text metadata
        }
        // Store files if present
        if (message.files) {
            // Note: We'll create a separate service for files if needed
            // For now, we'll just reference them in the item description
        }
        return { itemId: item.id, messageId: slackMessage.id };
    }
    /**
     * Ingest a channel's messages
     */
    async ingestChannel(channelId, workspaceId, userId, options = {}) {
        let accessToken = await slackService.getValidAccessToken(userId);
        const channel = await SlackChannelModel.findByChannelId(workspaceId, channelId);
        if (!channel) {
            throw new Error(`Channel ${channelId} not found in workspace ${workspaceId}`);
        }
        // Try to join the channel with bot token first
        const joined = await joinChannel(accessToken, channelId);
        if (!joined) {
            // If bot can't join, try using user token as fallback
            const userToken = await slackService.getUserToken(userId);
            if (userToken) {
                console.log(`[SlackIngestion] Bot couldn't join channel ${channelId}, using user token as fallback`);
                accessToken = userToken;
            }
            else {
                console.warn(`[SlackIngestion] Bot not in channel ${channelId} (${channel.channel_name || 'unknown'}) and no user token available, skipping`);
                return { ingested: 0, errors: 0 };
            }
        }
        let ingested = 0;
        let errors = 0;
        let hasMore = true;
        let oldest = options.oldest;
        while (hasMore && (!options.limit || ingested < options.limit)) {
            try {
                const { messages, hasMore: more } = await fetchChannelMessages(accessToken, channelId, oldest, Math.min(options.limit ? options.limit - ingested : 200, 200));
                for (const message of messages) {
                    try {
                        await this.ingestMessage(message, workspaceId, channelId, channel.channel_name, userId);
                        ingested++;
                        // Rate limiting: sleep 1ms per message
                        await sleep(1);
                    }
                    catch (error) {
                        console.error(`[SlackIngestion] Error ingesting message ${message.ts}:`, error);
                        errors++;
                    }
                }
                hasMore = more;
                if (messages.length > 0) {
                    oldest = messages[messages.length - 1].ts;
                }
                // Rate limiting: sleep 100ms between batches
                await sleep(100);
            }
            catch (error) {
                const errorMessage = error?.message || String(error);
                // Handle "not_in_channel" error - try user token if we haven't already
                if (errorMessage.includes('not_in_channel')) {
                    const userToken = await slackService.getUserToken(userId);
                    if (userToken && accessToken !== userToken) {
                        console.log(`[SlackIngestion] Bot token failed for channel ${channelId}, trying user token`);
                        accessToken = userToken;
                        // Retry with user token - don't break the loop
                        continue;
                    }
                    else {
                        console.warn(`[SlackIngestion] Bot not in channel ${channelId} (${channel.channel_name || 'unknown'}), skipping`);
                        hasMore = false;
                        // Don't count this as an error since it's expected behavior
                    }
                }
                else {
                    console.error(`[SlackIngestion] Error fetching messages for channel ${channelId}:`, error);
                    errors++;
                    hasMore = false;
                }
            }
        }
        return { ingested, errors };
    }
    /**
     * Ingest a thread's replies
     */
    async ingestThread(threadTs, channelId, workspaceId, userId) {
        let accessToken = await slackService.getValidAccessToken(userId);
        const channel = await SlackChannelModel.findByChannelId(workspaceId, channelId);
        if (!channel) {
            throw new Error(`Channel ${channelId} not found in workspace ${workspaceId}`);
        }
        // Try to join the channel with bot token first
        const joined = await joinChannel(accessToken, channelId);
        if (!joined) {
            // If bot can't join, try using user token as fallback
            const userToken = await slackService.getUserToken(userId);
            if (userToken) {
                console.log(`[SlackIngestion] Bot couldn't join channel ${channelId} for thread, using user token as fallback`);
                accessToken = userToken;
            }
            else {
                console.warn(`[SlackIngestion] Bot not in channel ${channelId} for thread ${threadTs} and no user token available, skipping`);
                return { ingested: 0, errors: 0 };
            }
        }
        let ingested = 0;
        let errors = 0;
        let hasMore = true;
        let cursor;
        while (hasMore) {
            try {
                const { messages, hasMore: more, nextCursor } = await fetchThreadReplies(accessToken, channelId, threadTs, 200);
                for (const message of messages) {
                    // Skip the parent message (it should already be ingested)
                    if (message.ts === threadTs) {
                        continue;
                    }
                    try {
                        await this.ingestMessage(message, workspaceId, channelId, channel.channel_name, userId);
                        ingested++;
                        // Rate limiting: sleep 1ms per message
                        await sleep(1);
                    }
                    catch (error) {
                        console.error(`[SlackIngestion] Error ingesting thread message ${message.ts}:`, error);
                        errors++;
                    }
                }
                hasMore = more;
                cursor = nextCursor;
                // Rate limiting: sleep 100ms between batches
                await sleep(100);
            }
            catch (error) {
                const errorMessage = error?.message || String(error);
                // Handle "not_in_channel" error - try user token if we haven't already
                if (errorMessage.includes('not_in_channel')) {
                    const userToken = await slackService.getUserToken(userId);
                    if (userToken && accessToken !== userToken) {
                        console.log(`[SlackIngestion] Bot token failed for channel ${channelId} thread ${threadTs}, trying user token`);
                        accessToken = userToken;
                        // Retry with user token - don't break the loop
                        continue;
                    }
                    else {
                        console.warn(`[SlackIngestion] Bot not in channel ${channelId} for thread ${threadTs}, skipping`);
                        hasMore = false;
                        // Don't count this as an error since it's expected behavior
                    }
                }
                else {
                    console.error(`[SlackIngestion] Error fetching thread replies for ${threadTs}:`, error);
                    errors++;
                    hasMore = false;
                }
            }
        }
        return { ingested, errors };
    }
    /**
     * Ingest all channels for a workspace
     */
    async ingestWorkspace(workspaceId, userId) {
        const accessToken = await slackService.getValidAccessToken(userId);
        const channels = await fetchChannels(accessToken);
        // Store/update channels
        for (const channel of channels) {
            await SlackChannelModel.createOrUpdate({
                workspaceId,
                channelId: channel.id,
                channelName: channel.name,
                channelType: getChannelType(channel),
                isPrivate: channel.is_private,
                isArchived: channel.is_archived,
            });
        }
        // Store/update workspace
        await SlackWorkspaceModel.createOrUpdate({
            workspaceId,
            userId,
            workspaceName: null, // Will be fetched separately
        });
        let totalMessages = 0;
        let totalErrors = 0;
        // Ingest messages from each channel
        for (const channel of channels) {
            if (channel.is_archived) {
                continue; // Skip archived channels
            }
            try {
                const result = await this.ingestChannel(channel.id, workspaceId, userId);
                totalMessages += result.ingested;
                totalErrors += result.errors;
                // Rate limiting: sleep 1 second between channels
                await sleep(1000);
            }
            catch (error) {
                const errorMessage = error?.message || String(error);
                // Handle "not_in_channel" error gracefully - this is expected when bot doesn't have access
                // Note: ingestChannel now handles joining channels and fallback to user token internally
                if (errorMessage.includes('not_in_channel')) {
                    console.warn(`[SlackIngestion] Bot not in channel ${channel.id} (${channel.name || 'unknown'}), skipping`);
                    // Don't count this as an error since it's expected behavior
                }
                else {
                    console.error(`[SlackIngestion] Error ingesting channel ${channel.id}:`, error);
                    totalErrors++;
                }
            }
        }
        return {
            channels: channels.length,
            messages: totalMessages,
            errors: totalErrors,
        };
    }
}
export const slackIngestionService = new SlackIngestionService();
//# sourceMappingURL=slackIngestion.js.map