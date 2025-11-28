import { EmbeddingModel, type SemanticSimilarityResult } from '../models/Embedding.js';
import { openAIService } from './openai.js';

export class EmbeddingService {
  /**
   * Truncate text to fit within token limits for embedding models
   * text-embedding-3-small: 8192 tokens max (~30,000 chars conservative estimate)
   * text-embedding-3-large: 8192 tokens max (~30,000 chars conservative estimate)
   *
   * Preserves the end of the text as it often contains more important information
   */
  private truncateForEmbedding(text: string, maxChars: number = 30000): string {
    if (text.length <= maxChars) {
      return text;
    }

    // Truncate from the beginning, preserving the end (which often has more important content)
    const truncated = text.substring(text.length - maxChars);
    console.warn(
      `[Embedding] Text truncated from ${text.length} to ${maxChars} characters to fit embedding model limits`
    );
    return truncated;
  }

  async createEmbedding(documentId: string, text: string): Promise<string> {
    // Truncate text if needed before generating embedding
    const truncatedText = this.truncateForEmbedding(text);

    // Generate embedding using OpenAI
    const embedding = await openAIService.createEmbedding(truncatedText);

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
    // Truncate query text if needed (queries are usually short, but just in case)
    const truncatedQuery = this.truncateForEmbedding(queryText, 30000);

    // Generate embedding for query
    const queryEmbedding = await openAIService.createEmbedding(truncatedQuery);

    // Find similar embeddings accessible to the requesting user
    return EmbeddingModel.findSimilar(queryEmbedding, options);
  }
}

export const embeddingService = new EmbeddingService();
