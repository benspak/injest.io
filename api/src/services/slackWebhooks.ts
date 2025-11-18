import { slackService } from './slack.js';
import { slackIngestionService } from './slackIngestion.js';
import { SlackOAuthTokenModel } from '../models/SlackOAuthToken.js';
import { SlackChannelModel } from '../models/SlackChannel.js';

const SLACK_API_BASE_URL = 'https://slack.com/api';

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

interface SlackEventWrapper {
  token?: string;
  team_id?: string;
  api_app_id?: string;
  event?: SlackEvent;
  type: string;
  event_id?: string;
  event_time?: number;
  challenge?: string; // For URL verification
  authed_users?: string[];
}

/**
 * Handle Slack Events API webhook
 */
export class SlackWebhookService {
  /**
   * Verify webhook request signature and timestamp
   */
  verifyRequest(
    timestamp: string,
    signature: string,
    body: string
  ): boolean {
    // Check timestamp (must be within 5 minutes)
    const requestTimestamp = parseInt(timestamp, 10);
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(currentTimestamp - requestTimestamp);

    if (timeDiff > 300) {
      // More than 5 minutes old
      console.warn('[SlackWebhook] Request timestamp too old:', timeDiff);
      return false;
    }

    return slackService.verifyWebhookSignature(timestamp, signature, body);
  }

  /**
   * Handle URL verification challenge
   */
  handleUrlVerification(challenge: string): { challenge: string } {
    return { challenge };
  }

  /**
   * Process a Slack event
   */
  async processEvent(event: SlackEvent, teamId: string): Promise<void> {
    if (!event || !event.type) {
      console.warn('[SlackWebhook] Invalid event:', event);
      return;
    }

    // Find user by workspace ID
    const tokens = await SlackOAuthTokenModel.findByWorkspaceId(teamId);
    if (tokens.length === 0) {
      console.warn(`[SlackWebhook] No tokens found for workspace ${teamId}`);
      return;
    }

    const userId = tokens[0].user_id;
    const workspaceId = teamId;

    switch (event.type) {
      case 'message':
        await this.handleMessageEvent(event, workspaceId, userId);
        break;
      case 'reaction_added':
        await this.handleReactionEvent(event, workspaceId, userId);
        break;
      case 'file_shared':
        await this.handleFileEvent(event, workspaceId, userId);
        break;
      default:
        console.log(`[SlackWebhook] Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Handle message events
   */
  private async handleMessageEvent(event: SlackEvent, workspaceId: string, userId: string): Promise<void> {
    if (!event.channel || !event.user || !event.ts) {
      return;
    }

    // Skip bot messages and messages without text/files
    if (event.subtype === 'bot_message' || event.subtype === 'message_changed' || event.subtype === 'message_deleted') {
      return;
    }

    // Get or create channel
    let channel = await SlackChannelModel.findByChannelId(workspaceId, event.channel);
    if (!channel) {
      // Fetch channel info from Slack API
      const accessToken = await slackService.getValidAccessToken(userId);
      try {
        const response = await fetch(`${SLACK_API_BASE_URL}/conversations.info?channel=${event.channel}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (response.ok) {
          const data = (await response.json()) as {
            ok: boolean;
            channel?: {
              name?: string;
              is_private?: boolean;
              is_archived?: boolean;
            };
          };
          if (data.ok && data.channel) {
            channel = await SlackChannelModel.createOrUpdate({
              workspaceId,
              channelId: event.channel,
              channelName: data.channel.name || null,
              channelType: event.channel_type || 'channel',
              isPrivate: data.channel.is_private || false,
              isArchived: data.channel.is_archived || false,
            });
          }
        }
      } catch (error) {
        console.error(`[SlackWebhook] Error fetching channel info:`, error);
      }
    }

    if (!channel) {
      console.warn(`[SlackWebhook] Channel ${event.channel} not found`);
      return;
    }

    // Ingest the message
    try {
      await slackIngestionService.ingestMessage(
        {
          ts: event.ts,
          user: event.user,
          text: event.text || '',
          thread_ts: event.thread_ts,
          files: event.files,
        },
        workspaceId,
        event.channel,
        channel.channel_name,
        userId
      );
    } catch (error) {
      console.error(`[SlackWebhook] Error ingesting message:`, error);
    }
  }

  /**
   * Handle reaction events
   */
  private async handleReactionEvent(event: SlackEvent, workspaceId: string, userId: string): Promise<void> {
    // Reactions are stored in the message, so we don't need to do anything special
    // The reaction data is already in the message when it's fetched
    console.log(`[SlackWebhook] Reaction added: ${event.reaction} to message ${event.item?.ts}`);
  }

  /**
   * Handle file shared events
   */
  private async handleFileEvent(event: SlackEvent, workspaceId: string, userId: string): Promise<void> {
    // Files are included in message events, so we don't need to handle this separately
    // But we could enhance this to download and process files
    console.log(`[SlackWebhook] File shared in channel ${event.channel}`);
  }
}

export const slackWebhookService = new SlackWebhookService();
