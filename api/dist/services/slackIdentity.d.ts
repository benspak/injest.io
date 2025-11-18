import { type Contact } from '../models/Contact.js';
/**
 * Unify Slack users with People entities (contacts)
 */
export declare class SlackIdentityService {
    /**
     * Map a Slack user to a contact
     */
    mapSlackUserToContact(userId: string, workspaceId: string, slackUserId: string, contactId: string): Promise<void>;
    /**
     * Get contact for a Slack user
     */
    getContactForSlackUser(userId: string, workspaceId: string, slackUserId: string): Promise<Contact | null>;
    /**
     * Get all Slack messages for a contact
     */
    getSlackMessagesForContact(userId: string, contactId: string): Promise<Array<{
        workspaceId: string;
        channelId: string;
        messageTs: string;
        text: string | null;
        createdAt: Date;
    }>>;
    /**
     * Auto-suggest mappings based on email/name matching
     */
    suggestMappings(userId: string, workspaceId: string, slackUserId: string): Promise<Contact[]>;
    /**
     * Fetch Slack user info from API
     */
    private fetchSlackUserInfo;
    /**
     * Remove mapping
     */
    removeMapping(userId: string, workspaceId: string, slackUserId: string): Promise<void>;
}
export declare const slackIdentityService: SlackIdentityService;
//# sourceMappingURL=slackIdentity.d.ts.map