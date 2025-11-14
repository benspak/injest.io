import { ItemModel } from '../models/Item.js';
import { ContactModel } from '../models/Contact.js';
import { UserModel } from '../models/User.js';
import { embeddingService } from './embeddings.js';
import { openAIService } from './openai.js';
import { itemStreamService } from './itemStream.js';
import { searchService } from './search.js';
import { SearchDocumentModel } from '../models/SearchDocument.js';
import { EmbeddingModel } from '../models/Embedding.js';
const serializeMetadata = (metadata) => {
    if (!metadata) {
        return '';
    }
    try {
        return JSON.stringify(metadata);
    }
    catch {
        return String(metadata);
    }
};
const buildContactSummary = (contact) => {
    const summaryParts = [];
    // Build full name from first and last name
    const fullName = contact.first_name || contact.last_name
        ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
        : contact.name;
    if (fullName)
        summaryParts.push(fullName);
    if (contact.email)
        summaryParts.push(`Email: ${contact.email}`);
    if (contact.phone)
        summaryParts.push(`Phone: ${contact.phone}`);
    const summary = summaryParts.join(' • ');
    const tags = new Set();
    tags.add('contact');
    if (contact.email) {
        const domain = contact.email.split('@')[1]?.toLowerCase() ?? '';
        if (domain) {
            tags.add(domain);
        }
    }
    if (contact.metadata && typeof contact.metadata === 'object') {
        const company = contact.metadata.company;
        if (typeof company === 'string' && company.trim().length > 0) {
            tags.add(company.trim().toLowerCase());
        }
    }
    return {
        summary: summary || 'Contact',
        tags: Array.from(tags),
    };
};
export class IndexingService {
    async indexItem(itemOrId, options = {}) {
        const maxAttempts = options.retries ?? 3;
        const itemId = typeof itemOrId === 'string' ? itemOrId : itemOrId.id;
        let item = null;
        if (typeof itemOrId === 'string') {
            for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
                item = await ItemModel.findById(itemId);
                if (item) {
                    break;
                }
                if (attempt < maxAttempts) {
                    // Exponential backoff (100ms, 200ms, 400ms, ...)
                    const delay = 100 * Math.pow(2, attempt - 1);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
            if (!item) {
                console.warn(`[Indexing] Item ${itemId} not found after ${maxAttempts} attempts; skipping embedding/indexing.`);
                return false;
            }
        }
        else {
            item = itemOrId;
        }
        try {
            const indexedItem = await this.performItemIndexing(item);
            if (!indexedItem) {
                return false;
            }
            itemStreamService.broadcastIndexedItem(indexedItem);
            await searchService.invalidateForItem(indexedItem.id);
            return true;
        }
        catch (error) {
            if (error?.code === '23503') {
                console.warn(`[Indexing] Skipping embedding for item ${itemId}: related item row not found (possibly deleted).`);
                return false;
            }
            console.error(`Error indexing item ${itemId}:`, error);
            throw error;
        }
    }
    async indexContact(contactOrId) {
        const contactId = typeof contactOrId === 'string' ? contactOrId : contactOrId.id;
        const contact = typeof contactOrId === 'string' ? await ContactModel.findById(contactId) : contactOrId;
        if (!contact) {
            console.warn(`[Indexing] Contact ${contactId} not found; skipping indexing.`);
            return false;
        }
        const document = await this.performContactIndexing(contact);
        if (!document) {
            return false;
        }
        return true;
    }
    async indexUser(userOrId) {
        const userId = typeof userOrId === 'string' ? userOrId : userOrId.id;
        const user = typeof userOrId === 'string' ? await UserModel.findById(userId) : userOrId;
        if (!user) {
            console.warn(`[Indexing] User ${userId} not found; skipping indexing.`);
            return false;
        }
        const document = await this.performUserIndexing(user);
        if (!document) {
            return false;
        }
        return true;
    }
    async removeSearchDocument(entityType, entityId) {
        const existing = await SearchDocumentModel.findByEntity(entityType, entityId);
        if (!existing) {
            return;
        }
        await EmbeddingModel.deleteByDocumentId(existing.id);
        await SearchDocumentModel.deleteByEntity(entityType, entityId);
    }
    async performItemIndexing(item) {
        const textParts = [];
        if (item.title)
            textParts.push(item.title);
        if (item.description)
            textParts.push(item.description);
        if (item.url)
            textParts.push(item.url);
        if (item.notes)
            textParts.push(item.notes);
        if (textParts.length === 0 && item.raw) {
            try {
                const parsed = JSON.parse(item.raw);
                if (typeof parsed === 'object') {
                    textParts.push(parsed.title || '', parsed.description || '', parsed.subject || '', parsed.body || '', parsed.text || '');
                }
                else {
                    textParts.push(item.raw);
                }
            }
            catch {
                textParts.push(item.raw);
            }
        }
        if (item.link_metadata) {
            const metadata = item.link_metadata;
            textParts.push(metadata.title || '', metadata.description || '', metadata.url || '');
        }
        if (item.attachments && Array.isArray(item.attachments)) {
            item.attachments.forEach((attachment) => {
                if (attachment.originalname)
                    textParts.push(attachment.originalname);
            });
        }
        const textContent = textParts.filter(Boolean).join(' ').trim();
        const textForEmbedding = [item.title, textContent, item.notes, item.description]
            .filter(Boolean)
            .join(' ')
            .trim();
        const classification = textForEmbedding
            ? await openAIService.classifyAndTag(textForEmbedding)
            : {
                type: item.type ?? 'note',
                category: 'general',
                tags: item.tags ?? [],
                summary: item.description ?? item.title ?? '',
            };
        const document = await SearchDocumentModel.upsert({
            ownerId: item.owner_id,
            entityType: 'item',
            entityId: item.id,
            title: item.title ?? classification.summary ?? null,
            content: textContent || null,
            summary: classification.summary ?? null,
            tags: classification.tags ?? null,
            metadata: {
                type: item.type ?? null,
                source: item.source ?? null,
                url: item.url ?? null,
                hasAttachments: Array.isArray(item.attachments) && item.attachments.length > 0,
                attachmentCount: Array.isArray(item.attachments) ? item.attachments.length : 0,
                createdAt: item.created_at,
                updatedAt: item.updated_at,
            },
        });
        let embeddingId = null;
        try {
            if (textForEmbedding.length > 0) {
                embeddingId = await embeddingService.createEmbedding(document.id, textForEmbedding);
            }
            else {
                await EmbeddingModel.deleteByDocumentId(document.id);
            }
        }
        catch (error) {
            if (error?.code === '23503') {
                console.warn(`[Indexing] Embedding skipped because search document ${document.id} was not found when creating embedding.`);
            }
            else {
                throw error;
            }
        }
        const updatedItem = await ItemModel.update(item.id, {
            clean: classification.summary ?? null,
            tags: classification.tags ?? null,
            embedding_id: embeddingId ?? undefined,
        });
        console.log(`[Indexing] Indexed item ${item.id}`);
        return updatedItem;
    }
    async performContactIndexing(contact) {
        const textParts = [];
        // Build full name from first and last name
        const fullName = contact.first_name || contact.last_name
            ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
            : contact.name;
        if (fullName)
            textParts.push(fullName);
        if (contact.first_name)
            textParts.push(contact.first_name);
        if (contact.last_name)
            textParts.push(contact.last_name);
        if (contact.email)
            textParts.push(contact.email);
        if (contact.phone)
            textParts.push(contact.phone);
        if (contact.metadata)
            textParts.push(serializeMetadata(contact.metadata));
        // Include matched user profile data if available
        let matchedUserProfile = null;
        if (contact.matched_user_id) {
            try {
                const matchedUser = await UserModel.findById(contact.matched_user_id);
                if (matchedUser && !matchedUser.profile_private) {
                    // Only include public profile data
                    matchedUserProfile = {
                        id: matchedUser.id,
                        public_username: matchedUser.public_username,
                        first_name: matchedUser.first_name,
                        last_name: matchedUser.last_name,
                        headline: matchedUser.headline,
                        bio: matchedUser.bio,
                        company: matchedUser.company,
                        project_title: matchedUser.project_title,
                        project_description: matchedUser.project_description,
                        city: matchedUser.city,
                        x_profile_url: matchedUser.x_profile_url,
                        youtube_url: matchedUser.youtube_url,
                        github_url: matchedUser.github_url,
                        linkedin_url: matchedUser.linkedin_url,
                    };
                    // Add matched user profile information to searchable text
                    if (matchedUser.first_name)
                        textParts.push(matchedUser.first_name);
                    if (matchedUser.last_name)
                        textParts.push(matchedUser.last_name);
                    if (matchedUser.headline)
                        textParts.push(matchedUser.headline);
                    if (matchedUser.bio)
                        textParts.push(matchedUser.bio);
                    if (matchedUser.company)
                        textParts.push(matchedUser.company);
                    if (matchedUser.project_title)
                        textParts.push(matchedUser.project_title);
                }
            }
            catch (error) {
                console.warn('[Indexing] Failed to fetch matched user profile for contact:', {
                    contactId: contact.id,
                    matchedUserId: contact.matched_user_id,
                    error,
                });
            }
        }
        const textContent = textParts.join(' ').trim();
        if (textContent.length === 0) {
            console.warn(`[Indexing] Contact ${contact.id} has no text content to index; skipping.`);
            return false;
        }
        const { summary, tags } = buildContactSummary(contact);
        const document = await SearchDocumentModel.upsert({
            ownerId: contact.owner_id,
            entityType: 'contact',
            entityId: contact.id,
            title: fullName ?? contact.email ?? summary,
            content: textContent,
            summary,
            tags,
            metadata: {
                email: contact.email,
                phone: contact.phone,
                sourceItemId: contact.source_item_id,
                matchedUserId: contact.matched_user_id,
                matchedUserProfile: matchedUserProfile,
                metadata: contact.metadata ?? {},
            },
        });
        try {
            await embeddingService.createEmbedding(document.id, textContent);
        }
        catch (error) {
            if (error?.code === '23503') {
                console.warn(`[Indexing] Embedding skipped because search document ${document.id} was not found when creating embedding.`);
                return false;
            }
            throw error;
        }
        console.log(`[Indexing] Indexed contact ${contact.id}`);
        return true;
    }
    async performUserIndexing(user) {
        const textParts = [];
        if (user.first_name)
            textParts.push(user.first_name);
        if (user.last_name)
            textParts.push(user.last_name);
        if (user.public_username)
            textParts.push(user.public_username);
        if (user.headline)
            textParts.push(user.headline);
        if (user.bio)
            textParts.push(user.bio);
        if (user.company)
            textParts.push(user.company);
        if (user.project_title)
            textParts.push(user.project_title);
        if (user.project_description)
            textParts.push(user.project_description);
        // Add social links as searchable text
        if (user.x_profile_url)
            textParts.push(user.x_profile_url);
        if (user.youtube_url)
            textParts.push(user.youtube_url);
        if (user.github_url)
            textParts.push(user.github_url);
        if (user.linkedin_url)
            textParts.push(user.linkedin_url);
        const textContent = textParts.join(' ').trim();
        if (textContent.length === 0) {
            console.warn(`[Indexing] User ${user.id} has no text content to index; skipping.`);
            return false;
        }
        // Build title from name or username
        const title = user.first_name && user.last_name
            ? `${user.first_name} ${user.last_name}`
            : user.first_name || user.last_name || user.public_username || user.email || 'User';
        // Build summary
        const summaryParts = [];
        if (user.first_name || user.last_name) {
            summaryParts.push(`${user.first_name || ''} ${user.last_name || ''}`.trim());
        }
        if (user.public_username) {
            summaryParts.push(`@${user.public_username}`);
        }
        if (user.headline) {
            summaryParts.push(user.headline);
        }
        const summary = summaryParts.join(' • ') || title;
        // Build tags
        const tags = new Set();
        tags.add('user');
        tags.add('profile');
        if (user.public_username) {
            tags.add(user.public_username.toLowerCase());
        }
        if (user.x_profile_url) {
            tags.add('x');
            tags.add('twitter');
        }
        if (user.youtube_url) {
            tags.add('youtube');
        }
        if (user.github_url) {
            tags.add('github');
        }
        if (user.linkedin_url) {
            tags.add('linkedin');
        }
        const document = await SearchDocumentModel.upsert({
            ownerId: user.id, // User profiles are owned by themselves
            entityType: 'user',
            entityId: user.id,
            title,
            content: textContent,
            summary,
            tags: Array.from(tags),
            metadata: {
                first_name: user.first_name,
                last_name: user.last_name,
                public_username: user.public_username,
                headline: user.headline,
                bio: user.bio,
                company: user.company,
                project_title: user.project_title,
                project_description: user.project_description,
                x_profile_url: user.x_profile_url,
                youtube_url: user.youtube_url,
                github_url: user.github_url,
                linkedin_url: user.linkedin_url,
                city: user.city,
            },
        });
        try {
            await embeddingService.createEmbedding(document.id, textContent);
        }
        catch (error) {
            if (error?.code === '23503') {
                console.warn(`[Indexing] Embedding skipped because search document ${document.id} was not found when creating embedding.`);
                return false;
            }
            throw error;
        }
        console.log(`[Indexing] Indexed user ${user.id}`);
        return true;
    }
}
export const indexingService = new IndexingService();
//# sourceMappingURL=indexing.js.map