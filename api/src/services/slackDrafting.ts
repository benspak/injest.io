import { slackService } from './slack.js';
import { SlackMessageModel } from '../models/SlackMessage.js';
import { SlackChannelModel } from '../models/SlackChannel.js';
import { ItemModel } from '../models/Item.js';
import { openAIService } from './openai.js';

const SLACK_API_BASE_URL = 'https://slack.com/api';

interface DraftReplyOptions {
  contextMessages?: number; // Number of previous messages to include as context
  tone?: 'professional' | 'casual' | 'friendly';
}

interface PostMessageOptions {
  threadTs?: string; // If replying to a thread
}

/**
 * Draft and post AI-generated replies to Slack
 */
export class SlackDraftingService {
  /**
   * Draft a reply to a message or thread
   */
  async draftReply(
    channelId: string,
    workspaceId: string,
    userId: string,
    threadTs: string | null,
    context: string,
    options: DraftReplyOptions = {}
  ): Promise<string> {
    const { contextMessages = 5, tone = 'professional' } = options;

    // Get channel info
    const channel = await SlackChannelModel.findByChannelId(workspaceId, channelId);
    const channelName = channel?.channel_name || 'channel';

    // Build context from recent messages
    let messageContext = '';
    if (threadTs) {
      // Get thread messages
      const threadMessages = await SlackMessageModel.findByThread(workspaceId, channelId, threadTs);
      const recentMessages = threadMessages.slice(-contextMessages);
      const messageTexts: string[] = [];
      for (const msg of recentMessages) {
        if (msg.item_id) {
          const item = await ItemModel.findById(msg.item_id);
          if (item && item.description) {
            messageTexts.push(item.description);
          } else if (msg.text) {
            messageTexts.push(msg.text);
          }
        } else if (msg.text) {
          messageTexts.push(msg.text);
        }
      }
      messageContext = messageTexts.join('\n\n');
    } else {
      // Get recent channel messages
      const recentMessages = await SlackMessageModel.findByChannel(workspaceId, channelId, contextMessages);
      const messageTexts: string[] = [];
      for (const msg of recentMessages.slice(-contextMessages)) {
        if (msg.item_id) {
          const item = await ItemModel.findById(msg.item_id);
          if (item && item.description) {
            messageTexts.push(item.description);
          } else if (msg.text) {
            messageTexts.push(msg.text);
          }
        } else if (msg.text) {
          messageTexts.push(msg.text);
        }
      }
      messageContext = messageTexts.join('\n\n');
    }

    // Build prompt
    const toneInstruction =
      tone === 'professional'
        ? 'Use a professional and clear tone.'
        : tone === 'casual'
        ? 'Use a casual and conversational tone.'
        : 'Use a friendly and approachable tone.';

    const prompt = `You are drafting a Slack message reply in #${channelName}. ${toneInstruction}

Context from recent messages:
${messageContext}

User's request/context:
${context}

Draft a concise and helpful reply. Keep it under 500 characters. Do not include markdown formatting.`;

    try {
      const draft = await openAIService.generate(prompt);
      return draft.trim();
    } catch (error) {
      console.error('[SlackDrafting] Error drafting reply:', error);
      throw new Error('Failed to draft reply');
    }
  }

  /**
   * Draft a new message (not a reply)
   */
  async draftMessage(
    channelId: string,
    workspaceId: string,
    userId: string,
    context: string,
    options: DraftReplyOptions = {}
  ): Promise<string> {
    const { tone = 'professional' } = options;

    // Get channel info
    const channel = await SlackChannelModel.findByChannelId(workspaceId, channelId);
    const channelName = channel?.channel_name || 'channel';

    // Build prompt
    const toneInstruction =
      tone === 'professional'
        ? 'Use a professional and clear tone.'
        : tone === 'casual'
        ? 'Use a casual and conversational tone.'
        : 'Use a friendly and approachable tone.';

    const prompt = `You are drafting a Slack message for #${channelName}. ${toneInstruction}

User's request/context:
${context}

Draft a concise and helpful message. Keep it under 500 characters. Do not include markdown formatting.`;

    try {
      const draft = await openAIService.generate(prompt);
      return draft.trim();
    } catch (error) {
      console.error('[SlackDrafting] Error drafting message:', error);
      throw new Error('Failed to draft message');
    }
  }

  /**
   * Post a message to Slack
   */
  async postMessage(
    channelId: string,
    workspaceId: string,
    userId: string,
    text: string,
    options: PostMessageOptions = {}
  ): Promise<{ ts: string; channel: string }> {
    const accessToken = await slackService.getValidAccessToken(userId);

    const body: Record<string, any> = {
      channel: channelId,
      text,
    };

    if (options.threadTs) {
      body.thread_ts = options.threadTs;
    }

    const response = await fetch(`${SLACK_API_BASE_URL}/chat.postMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string };
      throw new Error(`Failed to post message: ${errorData.error || 'Unknown error'}`);
    }

    const data = (await response.json()) as { ok: boolean; error?: string; ts?: string; channel?: string };
    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error || 'Unknown error'}`);
    }

    if (!data.ts || !data.channel) {
      throw new Error('Invalid response from Slack API');
    }

    return {
      ts: data.ts,
      channel: data.channel,
    };
  }

  /**
   * Draft and post a reply in one step
   */
  async draftAndPostReply(
    channelId: string,
    workspaceId: string,
    userId: string,
    threadTs: string,
    context: string,
    options: DraftReplyOptions & PostMessageOptions = {}
  ): Promise<{ ts: string; channel: string; draft: string }> {
    const draft = await this.draftReply(channelId, workspaceId, userId, threadTs, context, options);
    const result = await this.postMessage(channelId, workspaceId, userId, draft, { threadTs });
    return { ...result, draft };
  }
}

export const slackDraftingService = new SlackDraftingService();
