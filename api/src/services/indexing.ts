import { ItemModel } from '../models/Item.js';
import { embeddingService } from './embeddings.js';
import { openAIService } from './openai.js';

export class IndexingService {
  async indexItem(itemId: string): Promise<void> {
    try {
      const item = await ItemModel.findById(itemId);
      if (!item) {
        throw new Error('Item not found');
      }

      // Extract text content from unified fields
      const textParts: string[] = [];

      // Use unified fields first (new structure)
      if (item.title) textParts.push(item.title);
      if (item.description) textParts.push(item.description);
      if (item.url) textParts.push(item.url);
      if (item.notes) textParts.push(item.notes);

      // Fallback to raw field for backward compatibility (old items)
      if (textParts.length === 0 && item.raw) {
        try {
          const parsed = JSON.parse(item.raw);
          if (typeof parsed === 'object') {
            textParts.push(
              parsed.title || '',
              parsed.description || '',
              parsed.subject || '',
              parsed.body || '',
              parsed.text || ''
            );
          } else {
            textParts.push(item.raw);
          }
        } catch {
          textParts.push(item.raw);
        }
      }

      // Add link metadata content for searchability
      if (item.link_metadata) {
        const metadata = item.link_metadata;
        textParts.push(
          metadata.title || '',
          metadata.description || '',
          metadata.url || ''
        );
      }

      // Extract text from attachments (filenames, etc.)
      if (item.attachments && Array.isArray(item.attachments)) {
        item.attachments.forEach((attachment: any) => {
          if (attachment.originalname) textParts.push(attachment.originalname);
        });
      }

      const textContent = textParts.filter(Boolean).join(' ');

      // Classify and tag using OpenAI
      const classification = await openAIService.classifyAndTag(textContent);

      // Create embedding
      const embeddingId = await embeddingService.createEmbedding(itemId, textContent);

      // Update item with structured data
      await ItemModel.update(itemId, {
        clean: classification.summary,
        tags: classification.tags,
        embedding_id: embeddingId,
      });

      console.log(`Indexed item ${itemId}`);
    } catch (error) {
      console.error(`Error indexing item ${itemId}:`, error);
      throw error;
    }
  }
}

export const indexingService = new IndexingService();
