import { ItemModel } from '../models/Item.js';
import { ContactModel } from '../models/Contact.js';
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
    if (contact.name)
        summaryParts.push(contact.name);
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
        if (contact.name)
            textParts.push(contact.name);
        if (contact.email)
            textParts.push(contact.email);
        if (contact.phone)
            textParts.push(contact.phone);
        if (contact.metadata)
            textParts.push(serializeMetadata(contact.metadata));
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
            title: contact.name ?? contact.email ?? summary,
            content: textContent,
            summary,
            tags,
            metadata: {
                email: contact.email,
                phone: contact.phone,
                sourceItemId: contact.source_item_id,
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
}
export const indexingService = new IndexingService();
//# sourceMappingURL=indexing.js.map