import { EmbeddingModel } from '../models/Embedding.js';
import { openAIService } from './openai.js';
export class EmbeddingService {
    async createEmbedding(itemId, text) {
        // Generate embedding using OpenAI
        const embedding = await openAIService.createEmbedding(text);
        // Store in database
        const embeddingRecord = await EmbeddingModel.create(itemId, embedding);
        return embeddingRecord.id;
    }
    async findSimilar(queryText, options) {
        // Generate embedding for query
        const queryEmbedding = await openAIService.createEmbedding(queryText);
        // Find similar embeddings accessible to the requesting user
        return EmbeddingModel.findSimilar(queryEmbedding, options);
    }
}
export const embeddingService = new EmbeddingService();
//# sourceMappingURL=embeddings.js.map