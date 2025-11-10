import { ItemModel } from '../models/Item.js';
import { embeddingService } from './embeddings.js';
import { openAIService } from './openai.js';
import { itemStreamService } from './itemStream.js';
import { searchService } from './search.js';
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
            const updatedItem = await this.performIndexing(item);
            if (!updatedItem) {
                return false;
            }
            itemStreamService.broadcastIndexedItem(updatedItem);
            await searchService.invalidateForItem(updatedItem.id);
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
    async performIndexing(item) {
        // Extract text content from unified fields
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
        const textContent = textParts.filter(Boolean).join(' ');
        const classification = await openAIService.classifyAndTag(textContent);
        let embeddingId = null;
        try {
            embeddingId = await embeddingService.createEmbedding(item.id, textContent);
        }
        catch (error) {
            if (error?.code === '23503') {
                console.warn(`[Indexing] Embedding skipped because item ${item.id} was not found when creating embedding.`);
                return null;
            }
            throw error;
        }
        const updatedItem = await ItemModel.update(item.id, {
            clean: classification.summary,
            tags: classification.tags,
            embedding_id: embeddingId,
        });
        console.log(`Indexed item ${item.id}`);
        return updatedItem;
    }
}
export const indexingService = new IndexingService();
//# sourceMappingURL=indexing.js.map