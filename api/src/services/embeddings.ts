import { EmbeddingModel, type SemanticSimilarityResult } from '../models/Embedding.js';
import { openAIService } from './openai.js';

export class EmbeddingService {
  async createEmbedding(documentId: string, text: string): Promise<string> {
    // Generate embedding using OpenAI
    const embedding = await openAIService.createEmbedding(text);

    // Store in database
    const embeddingRecord = await EmbeddingModel.create(documentId, embedding);

    return embeddingRecord.id;
  }

  async findSimilar(
    queryText: string,
    options: {
      userId: string;
      email?: string | null;
      limit?: number;
      candidateMultiplier?: number;
      titlePatterns?: string[];
      filters?: import('../types/search.js').SearchFilters;
    }
  ): Promise<SemanticSimilarityResult[]> {
    // Generate embedding for query
    const queryEmbedding = await openAIService.createEmbedding(queryText);

    // Find similar embeddings accessible to the requesting user
    return EmbeddingModel.findSimilar(queryEmbedding, options);
  }
}

export const embeddingService = new EmbeddingService();
