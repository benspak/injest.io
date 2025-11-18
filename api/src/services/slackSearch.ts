import { searchService } from './search.js';
import { SlackMessageModel } from '../models/SlackMessage.js';
import { SlackChannelModel } from '../models/SlackChannel.js';
import { ItemModel } from '../models/Item.js';

interface SlackSearchResult {
  item: {
    id: string;
    title: string | null;
    description: string | null;
    source: string | null;
    tags: string[] | null;
    created_at: Date;
  };
  slackMessage: {
    id: string;
    workspace_id: string;
    channel_id: string;
    message_ts: string;
    thread_ts: string | null;
    slack_user_id: string;
    text: string | null;
  };
  channel: {
    id: string;
    channel_name: string | null;
    channel_type: string | null;
  } | null;
  similarity: number;
  permalink: string | null;
}

interface SlackSearchOptions {
  channelId?: string;
  workspaceId?: string;
  limit?: number;
  minSimilarity?: number;
}

/**
 * Generate Slack message permalink
 */
function generatePermalink(workspaceId: string, channelId: string, messageTs: string): string {
  // Extract workspace domain from workspace ID (this is a simplified version)
  // In production, you'd want to store the workspace domain
  return `https://slack.com/archives/${channelId}/p${messageTs.replace('.', '')}`;
}

export class SlackSearchService {
  /**
   * Search Slack messages semantically
   */
  async searchMessages(
    userId: string,
    query: string,
    options: SlackSearchOptions = {}
  ): Promise<SlackSearchResult[]> {
    const { channelId, workspaceId, limit = 10, minSimilarity = 0.3 } = options;

    // Build source filter for Slack messages
    let sourceFilter: string[] | undefined;
    if (workspaceId && channelId) {
      sourceFilter = [`slack:${workspaceId}:${channelId}`];
    } else if (workspaceId) {
      // Search all channels in workspace - we'll need to filter results
      sourceFilter = [`slack:${workspaceId}:`];
    } else {
      // Search all Slack messages
      sourceFilter = ['slack:'];
    }

    // Use existing search service with source filter
    const searchResults = await searchService.search(
      { id: userId },
      query,
      limit * 2, // Get more results to filter
      {
        sources: sourceFilter,
      }
    );

    // Filter and enrich results with Slack-specific data
    const results: SlackSearchResult[] = [];

    for (const result of searchResults) {
      if (!result.item.source?.startsWith('slack:')) {
        continue;
      }

      // Parse source: slack:workspaceId:channelId
      const sourceParts = result.item.source.split(':');
      if (sourceParts.length < 3) {
        continue;
      }

      const msgWorkspaceId = sourceParts[1];
      const msgChannelId = sourceParts[2];

      // Apply workspace filter if specified
      if (workspaceId && msgWorkspaceId !== workspaceId) {
        continue;
      }

      // Apply channel filter if specified
      if (channelId && msgChannelId !== channelId) {
        continue;
      }

      // Find Slack message by item ID
      const slackMessage = await SlackMessageModel.findByItemId(result.item.id);
      if (!slackMessage) {
        continue;
      }

      // Get channel info
      const channel = await SlackChannelModel.findByChannelId(msgWorkspaceId, msgChannelId);

      // Generate permalink
      const permalink = generatePermalink(msgWorkspaceId, msgChannelId, slackMessage.message_ts);

      results.push({
        item: result.item,
        slackMessage: {
          id: slackMessage.id,
          workspace_id: slackMessage.workspace_id,
          channel_id: slackMessage.channel_id,
          message_ts: slackMessage.message_ts,
          thread_ts: slackMessage.thread_ts,
          slack_user_id: slackMessage.slack_user_id,
          text: slackMessage.text,
        },
        channel: channel
          ? {
              id: channel.id,
              channel_name: channel.channel_name,
              channel_type: channel.channel_type,
            }
          : null,
        similarity: result.similarity,
        permalink,
      });

      if (results.length >= limit) {
        break;
      }
    }

    return results;
  }

  /**
   * Search messages in a specific channel
   */
  async searchChannel(
    userId: string,
    channelId: string,
    workspaceId: string,
    query: string,
    options: { limit?: number; minSimilarity?: number } = {}
  ): Promise<SlackSearchResult[]> {
    return this.searchMessages(userId, query, {
      channelId,
      workspaceId,
      ...options,
    });
  }

  /**
   * Get message context (thread messages)
   */
  async getMessageContext(
    userId: string,
    workspaceId: string,
    channelId: string,
    messageTs: string
  ): Promise<{
    message: SlackSearchResult | null;
    thread: SlackSearchResult[];
  }> {
    // Find the message
    const slackMessage = await SlackMessageModel.findByMessageTs(workspaceId, channelId, messageTs);
    if (!slackMessage || !slackMessage.item_id) {
      return { message: null, thread: [] };
    }

    // Get item
    const item = await ItemModel.findById(slackMessage.item_id);
    if (!item) {
      return { message: null, thread: [] };
    }

    // Get channel
    const channel = await SlackChannelModel.findByChannelId(workspaceId, channelId);

    // Build message result
    const message: SlackSearchResult = {
      item: {
        id: item.id,
        title: item.title || null,
        description: item.description || null,
        source: item.source || null,
        tags: item.tags || null,
        created_at: item.created_at,
      },
      slackMessage: {
        id: slackMessage.id,
        workspace_id: slackMessage.workspace_id,
        channel_id: slackMessage.channel_id,
        message_ts: slackMessage.message_ts,
        thread_ts: slackMessage.thread_ts,
        slack_user_id: slackMessage.slack_user_id,
        text: slackMessage.text,
      },
      channel: channel
        ? {
            id: channel.id,
            channel_name: channel.channel_name,
            channel_type: channel.channel_type,
          }
        : null,
      similarity: 1.0,
      permalink: generatePermalink(workspaceId, channelId, slackMessage.message_ts),
    };

    // Get thread messages if this is a thread
    const thread: SlackSearchResult[] = [];
    if (slackMessage.thread_ts) {
      const threadMessages = await SlackMessageModel.findByThread(workspaceId, channelId, slackMessage.thread_ts);
      for (const threadMsg of threadMessages) {
        if (threadMsg.message_ts === messageTs) {
          continue; // Skip the parent message
        }

        if (!threadMsg.item_id) {
          continue;
        }

        const threadItem = await ItemModel.findById(threadMsg.item_id);
        if (!threadItem) {
          continue;
        }

        thread.push({
          item: {
            id: threadItem.id,
            title: threadItem.title || null,
            description: threadItem.description || null,
            source: threadItem.source || null,
            tags: threadItem.tags || null,
            created_at: threadItem.created_at,
          },
          slackMessage: {
            id: threadMsg.id,
            workspace_id: threadMsg.workspace_id,
            channel_id: threadMsg.channel_id,
            message_ts: threadMsg.message_ts,
            thread_ts: threadMsg.thread_ts,
            slack_user_id: threadMsg.slack_user_id,
            text: threadMsg.text,
          },
          channel: channel
            ? {
                id: channel.id,
                channel_name: channel.channel_name,
                channel_type: channel.channel_type,
              }
            : null,
          similarity: 1.0,
          permalink: generatePermalink(workspaceId, channelId, threadMsg.message_ts),
        });
      }
    }

    return { message, thread };
  }
}

export const slackSearchService = new SlackSearchService();
