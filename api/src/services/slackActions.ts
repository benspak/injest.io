import { SlackMessageModel } from '../models/SlackMessage.js';
import { ItemModel } from '../models/Item.js';
// Task model will be created separately if needed
import { openAIService } from './openai.js';
import { indexingService } from './indexing.js';
import { FRONTEND_URL } from '../config/auth.js';

interface ExtractResult {
  itemId: string;
  itemType: 'note' | 'task';
  itemTitle: string;
  itemUrl: string;
}

/**
 * Extract actions from Slack messages and convert to items/tasks
 */
export class SlackActionsService {
  /**
   * Extract a message to an item or task
   */
  async extractToItem(
    workspaceId: string,
    channelId: string,
    messageTs: string,
    userId: string,
    options: { type?: 'note' | 'task'; force?: boolean } = {}
  ): Promise<ExtractResult> {
    // Find the message
    const slackMessage = await SlackMessageModel.findByMessageTs(workspaceId, channelId, messageTs);
    if (!slackMessage) {
      throw new Error('Message not found');
    }

    // If message already has an item, return it unless force is true
    if (slackMessage.item_id && !options.force) {
      const existingItem = await ItemModel.findById(slackMessage.item_id);
      if (existingItem) {
        return {
          itemId: existingItem.id,
          itemType: (existingItem.type as 'note' | 'task') || 'note',
          itemTitle: existingItem.title || 'Untitled',
          itemUrl: `${FRONTEND_URL}/items/${existingItem.id}`,
        };
      }
    }

    // Get message text
    let messageText = slackMessage.text || '';
    if (slackMessage.item_id) {
      const item = await ItemModel.findById(slackMessage.item_id);
      if (item && item.description) {
        messageText = item.description;
      }
    }

    // Determine type (note or task)
    let itemType: 'note' | 'task' = options.type || 'note';
    if (!options.type) {
      // Use AI to determine if it's a task
      try {
        const classification = await openAIService.classifyAndTag(messageText);
        // Check if it looks like a task (has action items, todos, etc.)
        if (
          classification.tags.some((tag) => ['task', 'todo', 'action', 'reminder'].includes(tag.toLowerCase())) ||
          classification.summary.toLowerCase().includes('todo') ||
          classification.summary.toLowerCase().includes('task')
        ) {
          itemType = 'task';
        }
      } catch (error) {
        console.warn('[SlackActions] Error classifying message, defaulting to note:', error);
      }
    }

    // Extract structured data using AI
    let title = messageText.substring(0, 100);
    let description = messageText;
    let tags: string[] = ['slack'];

    try {
      const classification = await openAIService.classifyAndTag(messageText);
      if (classification.summary) {
        title = classification.summary.substring(0, 100);
        description = messageText; // Keep full text as description
      }
      if (classification.tags && classification.tags.length > 0) {
        tags = [...tags, ...classification.tags];
      }
    } catch (error) {
      console.warn('[SlackActions] Error extracting structured data:', error);
    }

    // Build source URL for traceability
    const source = `slack:${workspaceId}:${channelId}:${messageTs}`;
    const permalink = `https://slack.com/archives/${channelId}/p${messageTs.replace('.', '')}`;

    // Add permalink to description
    description = `${description}\n\n[View original message](${permalink})`;

    // Create item
    const item = await ItemModel.create({
      owner_id: userId,
      type: itemType,
      title,
      description,
      source,
      tags,
      notes: `Extracted from Slack message ${messageTs}`,
    });

    // Note: Task creation would go here if TaskModel is implemented
    // For now, tasks are just items with type='task'

    // Link message to item
    await SlackMessageModel.update(workspaceId, channelId, messageTs, {
      itemId: item.id,
    });

    // Index the item
    await indexingService.indexItem(item.id);

    return {
      itemId: item.id,
      itemType,
      itemTitle: item.title || 'Untitled',
      itemUrl: `${FRONTEND_URL}/items/${item.id}`,
    };
  }

  /**
   * Extract a message to a task specifically
   */
  async extractToTask(
    workspaceId: string,
    channelId: string,
    messageTs: string,
    userId: string
  ): Promise<ExtractResult> {
    return this.extractToItem(workspaceId, channelId, messageTs, userId, { type: 'task' });
  }
}

export const slackActionsService = new SlackActionsService();
