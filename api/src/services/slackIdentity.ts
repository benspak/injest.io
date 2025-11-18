import { SlackUserMappingModel } from '../models/SlackUserMapping.js';
import { SlackMessageModel } from '../models/SlackMessage.js';
import { ContactModel, type Contact } from '../models/Contact.js';
import { slackService } from './slack.js';

const SLACK_API_BASE_URL = 'https://slack.com/api';

interface SlackUserInfo {
  id: string;
  name: string;
  real_name?: string;
  email?: string;
  display_name?: string;
}

interface SlackUserInfoResponse {
  ok: boolean;
  user?: SlackUserInfo;
  error?: string;
}

/**
 * Unify Slack users with People entities (contacts)
 */
export class SlackIdentityService {
  /**
   * Map a Slack user to a contact
   */
  async mapSlackUserToContact(
    userId: string,
    workspaceId: string,
    slackUserId: string,
    contactId: string
  ): Promise<void> {
    // Get Slack user info to store
    let slackUsername: string | null = null;
    let slackEmail: string | null = null;

    try {
      const accessToken = await slackService.getValidAccessToken(userId);
      const userInfo = await this.fetchSlackUserInfo(accessToken, slackUserId);
      if (userInfo) {
        slackUsername = userInfo.name || null;
        slackEmail = userInfo.email || null;
      }
    } catch (error) {
      console.warn(`[SlackIdentity] Error fetching Slack user info:`, error);
    }

    // Create or update mapping
    await SlackUserMappingModel.createOrUpdate({
      userId,
      workspaceId,
      slackUserId,
      contactId,
      slackUsername,
      slackEmail,
    });
  }

  /**
   * Get contact for a Slack user
   */
  async getContactForSlackUser(
    userId: string,
    workspaceId: string,
    slackUserId: string
  ): Promise<Contact | null> {
    const mapping = await SlackUserMappingModel.findBySlackUserId(userId, workspaceId, slackUserId);
    if (!mapping || !mapping.contact_id) {
      return null;
    }

    return await ContactModel.findById(mapping.contact_id);
  }

  /**
   * Get all Slack messages for a contact
   */
  async getSlackMessagesForContact(userId: string, contactId: string): Promise<Array<{
    workspaceId: string;
    channelId: string;
    messageTs: string;
    text: string | null;
    createdAt: Date;
  }>> {
    // Get all mappings for this contact
    const mappings = await SlackUserMappingModel.findByContactId(userId, contactId);
    if (mappings.length === 0) {
      return [];
    }

    // Get messages from all mapped Slack users
    const allMessages: Array<{
      workspaceId: string;
      channelId: string;
      messageTs: string;
      text: string | null;
      createdAt: Date;
    }> = [];

    for (const mapping of mappings) {
      const messages = await SlackMessageModel.findBySlackUserId(mapping.workspace_id, mapping.slack_user_id, 100);
      for (const msg of messages) {
        allMessages.push({
          workspaceId: msg.workspace_id,
          channelId: msg.channel_id,
          messageTs: msg.message_ts,
          text: msg.text,
          createdAt: msg.created_at,
        });
      }
    }

    // Sort by creation date (newest first)
    allMessages.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return allMessages;
  }

  /**
   * Auto-suggest mappings based on email/name matching
   */
  async suggestMappings(userId: string, workspaceId: string, slackUserId: string): Promise<Contact[]> {
    // Get Slack user info
    let slackUserInfo: SlackUserInfo | null = null;
    try {
      const accessToken = await slackService.getValidAccessToken(userId);
      slackUserInfo = await this.fetchSlackUserInfo(accessToken, slackUserId);
    } catch (error) {
      console.warn(`[SlackIdentity] Error fetching Slack user info for suggestions:`, error);
      return [];
    }

    if (!slackUserInfo) {
      return [];
    }

    // Get all contacts for the user
    const contacts = await ContactModel.listByOwner(userId, { limit: 1000 });

    // Match by email first
    if (slackUserInfo.email) {
      const emailMatch = contacts.find((c: Contact) => c.email?.toLowerCase() === slackUserInfo!.email?.toLowerCase());
      if (emailMatch) {
        return [emailMatch];
      }
    }

    // Match by name
    const nameMatches: Contact[] = [];
    const slackName = (slackUserInfo.real_name || slackUserInfo.name || '').toLowerCase();
    const slackDisplayName = (slackUserInfo.display_name || '').toLowerCase();

    for (const contact of contacts) {
      const contactName = contact.name?.toLowerCase() || '';
      const contactFirstName = contact.first_name?.toLowerCase() || '';
      const contactLastName = contact.last_name?.toLowerCase() || '';
      const contactFullName = `${contactFirstName} ${contactLastName}`.trim().toLowerCase();

      // Check various name combinations
      if (
        contactName === slackName ||
        contactName === slackDisplayName ||
        contactFullName === slackName ||
        contactFullName === slackDisplayName ||
        contactFirstName === slackName.split(' ')[0] ||
        contactLastName === slackName.split(' ').slice(-1)[0]
      ) {
        nameMatches.push(contact);
      }
    }

    return nameMatches.slice(0, 5); // Return top 5 matches
  }

  /**
   * Fetch Slack user info from API
   */
  private async fetchSlackUserInfo(accessToken: string, slackUserId: string): Promise<SlackUserInfo | null> {
    try {
      const response = await fetch(`${SLACK_API_BASE_URL}/users.info?user=${slackUserId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as SlackUserInfoResponse;
      if (!data.ok || !data.user) {
        return null;
      }

      return data.user;
    } catch (error) {
      console.error(`[SlackIdentity] Error fetching user info:`, error);
      return null;
    }
  }

  /**
   * Remove mapping
   */
  async removeMapping(userId: string, workspaceId: string, slackUserId: string): Promise<void> {
    await SlackUserMappingModel.delete(userId, workspaceId, slackUserId);
  }
}

export const slackIdentityService = new SlackIdentityService();
