import { EmbeddingModel } from '../models/Embedding.js';
import { openAIService } from './openai.js';

export class EmbeddingService {
  async createEmbedding(itemId: string, text: string): Promise<string> {
    // Generate embedding using OpenAI
    const embedding = await openAIService.createEmbedding(text);

    // Store in database
    const embeddingRecord = await EmbeddingModel.create(itemId, embedding);

    return embeddingRecord.id;
  }

  async findSimilar(queryText: string, limit: number = 10): Promise<Array<{ embedding: import('../models/Embedding.js').Embedding; similarity: number }>> {
    // Generate embedding for query
    const queryEmbedding = await openAIService.createEmbedding(queryText);

    // Find similar embeddings
    const similar = await EmbeddingModel.findSimilar(queryEmbedding, limit);

    return similar.map((emb) => ({
      embedding: emb,
      similarity: parseFloat(String(emb.similarity || '0')) || 0,
    }));
  }
}

export const embeddingService = new EmbeddingService();
