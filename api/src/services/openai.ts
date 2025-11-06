import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { openAIRateLimiter } from '../utils/rateLimiter.js';

dotenv.config();

export class OpenAIService {
  private client: OpenAI;

  // Model configuration - use cheaper models for simple tasks
  // Embedding model: Use small for 10x cost savings (requires DB migration to 1536 dims)
  // Default to large to avoid breaking existing embeddings until migration is run
  private readonly EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL === 'small'
    ? 'text-embedding-3-small'  // 1536 dims, 10x cheaper
    : 'text-embedding-3-large';  // 3072 dims (default for compatibility)

  private readonly SIMPLE_TASK_MODEL = 'gpt-3.5-turbo'; // For simple tasks (10-30x cheaper than GPT-4)
  private readonly ADVANCED_TASK_MODEL = 'gpt-4-turbo-preview'; // For complex tasks that need GPT-4

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Log model configuration
    console.log(`[OpenAI] Using embedding model: ${this.EMBEDDING_MODEL}`);
    console.log(`[OpenAI] Using chat model (simple): ${this.SIMPLE_TASK_MODEL}`);
    console.log(`[OpenAI] Using chat model (advanced): ${this.ADVANCED_TASK_MODEL}`);
  }

  /**
   * Wait for rate limit permission before making API call
   */
  private async waitForRateLimit(): Promise<void> {
    await openAIRateLimiter.waitForPermission();
  }

  /**
   * Execute OpenAI API call with retry logic for rate limits
   */
  private async executeWithRetry<T>(
    apiCall: () => Promise<T>,
    maxRetries: number = 5,
    baseDelay: number = 2000
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error: any) {
        lastError = error;

        // Check if it's a rate limit error (429)
        // OpenAI SDK errors can have different structures
        const isRateLimit =
          error?.status === 429 ||
          error?.statusCode === 429 ||
          error?.code === 'rate_limit_exceeded' ||
          error?.type === 'rate_limit_error' ||
          (error?.message && error.message.includes('rate limit'));

        if (isRateLimit) {
          // Try to get retry-after from various possible locations
          let retryAfter: number | null = null;

          if (error?.response?.headers?.['retry-after']) {
            retryAfter = parseInt(error.response.headers['retry-after'], 10) * 1000;
          } else if (error?.headers?.['retry-after']) {
            retryAfter = parseInt(error.headers['retry-after'], 10) * 1000;
          } else if (error?.retryAfter) {
            retryAfter = error.retryAfter * 1000;
          }

          // Use retry-after header if available, otherwise exponential backoff with jitter
          const exponentialDelay = baseDelay * Math.pow(2, attempt);
          const jitter = Math.random() * 1000; // Add random jitter to avoid thundering herd
          const delay = retryAfter || (exponentialDelay + jitter);

          if (attempt < maxRetries - 1) {
            const delaySeconds = Math.ceil(delay / 1000);
            console.warn(
              `[OpenAI] Rate limit hit (429), retrying in ${delaySeconds}s (attempt ${attempt + 1}/${maxRetries}). ` +
              `Error: ${error?.message || 'Unknown error'}`
            );
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }

        // For non-rate-limit errors, throw immediately (unless it's the last attempt)
        if (attempt === maxRetries - 1 || !isRateLimit) {
          throw error;
        }
      }
    }

    throw lastError;
  }

  async createEmbedding(text: string): Promise<number[]> {
    await this.waitForRateLimit();
    return this.executeWithRetry(async () => {
      const response = await this.client.embeddings.create({
        model: this.EMBEDDING_MODEL,
        input: text,
      });
      return response.data[0].embedding;
    });
  }

  async classifyAndTag(text: string): Promise<{ type: string; category: string; tags: string[]; summary: string }> {
    // Optimized prompt - more concise to reduce tokens
    const contentPreview = text.substring(0, 1500); // Reduced from 2000 to save tokens

    const prompt = `Classify this content. Respond with JSON only:
{
  "type": "note|link|file|email|task",
  "category": "brief category",
  "tags": ["tag1", "tag2", "tag3"],
  "summary": "max 200 chars"
}

Content: ${contentPreview}`;

    await this.waitForRateLimit();
    const response = await this.executeWithRetry(async () => {
      return await this.client.chat.completions.create({
        model: this.SIMPLE_TASK_MODEL, // GPT-3.5 is sufficient for classification
        messages: [
          { role: 'system', content: 'Respond with valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 200, // Limit response length to save tokens
        response_format: { type: 'json_object' }, // Structured output for better reliability
      });
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    try {
      return JSON.parse(content);
    } catch (error) {
      // Fallback if JSON parsing fails
      return {
        type: 'note',
        category: 'general',
        tags: [],
        summary: text.substring(0, 200),
      };
    }
  }

  async generate(prompt: string, context?: string): Promise<string> {
    // Use GPT-4 for user-facing generation as it may need better quality
    const messages: any[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
    ];

    if (context) {
      // Limit context to reduce tokens
      const limitedContext = context.length > 2000 ? context.substring(0, 2000) + '...' : context;
      messages.push({ role: 'system', content: `Context: ${limitedContext}` });
    }

    messages.push({ role: 'user', content: prompt });

    await this.waitForRateLimit();
    const response = await this.executeWithRetry(async () => {
      return await this.client.chat.completions.create({
        model: this.ADVANCED_TASK_MODEL, // Keep GPT-4 for user-facing generation
        messages,
        temperature: 0.7,
        max_tokens: 1000, // Limit response length
      });
    });

    return response.choices[0].message.content || '';
  }

  /**
   * Generate a title and description from file content
   */
  async generateTitleAndDescription(fileContent: string, filename?: string): Promise<{ title: string; description: string }> {
    // Reduced content length to save tokens (3000 chars instead of 4000)
    const contentPreview = fileContent.substring(0, 3000);

    const prompt = `Generate title and description. JSON only:
{
  "title": "3-10 words",
  "description": "1-2 sentences, max 200 chars"
}

File${filename ? ` "${filename}"` : ''}:
${contentPreview}`;

    await this.waitForRateLimit();
    const response = await this.executeWithRetry(async () => {
      return await this.client.chat.completions.create({
        model: this.SIMPLE_TASK_MODEL, // GPT-3.5 is sufficient for title/description
        messages: [
          { role: 'system', content: 'Respond with valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.5,
        max_tokens: 150, // Limit response length
        response_format: { type: 'json_object' },
      });
    });

    const content = response.choices[0].message.content;
    if (!content) {
      // Fallback to filename-based title
      const fallbackTitle = filename ? path.basename(filename, path.extname(filename)) : 'Untitled Document';
      return {
        title: fallbackTitle,
        description: fileContent.substring(0, 200).trim() || 'No description available',
      };
    }

    try {
      const parsed = JSON.parse(content);
      return {
        title: parsed.title || (filename ? path.basename(filename, path.extname(filename)) : 'Untitled Document'),
        description: parsed.description || fileContent.substring(0, 200).trim() || 'No description available',
      };
    } catch (error) {
      // Fallback if JSON parsing fails
      const fallbackTitle = filename ? path.basename(filename, path.extname(filename)) : 'Untitled Document';
      return {
        title: fallbackTitle,
        description: fileContent.substring(0, 200).trim() || 'No description available',
      };
    }
  }

  /**
   * Generate tags from item content (title, description, notes, etc.)
   */
  async generateTags(content: string): Promise<string[]> {
    if (!content || content.trim().length === 0) {
      return [];
    }

    // Reduced content length (1500 chars instead of 2000)
    const contentPreview = content.substring(0, 1500);

    const prompt = `Generate 3-5 tags (JSON array only):
["tag1", "tag2", "tag3"]

Content: ${contentPreview}`;

    try {
      await this.waitForRateLimit();
      const response = await this.executeWithRetry(async () => {
        return await this.client.chat.completions.create({
          model: this.SIMPLE_TASK_MODEL, // GPT-3.5 is sufficient for tagging
          messages: [
            {
              role: 'system',
              content: 'Respond with only a JSON array of tag strings.'
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 100, // Limit response length
        });
      });

      const content = response.choices[0].message.content;
      if (!content) {
        return [];
      }

      // Try to parse JSON array
      const tags = JSON.parse(content.trim());
      if (Array.isArray(tags)) {
        // Filter and clean tags
        return tags
          .filter((tag: any) => typeof tag === 'string' && tag.trim().length > 0)
          .map((tag: string) => tag.trim().toLowerCase())
          .slice(0, 5); // Limit to 5 tags max
      }

      return [];
    } catch (error) {
      console.error('Error generating tags:', error);
      // Return empty array on error - don't fail the request
      return [];
    }
  }

  /**
   * Generate email summary as 3 bullet points
   */
  async generateEmailSummary(emailBody: string): Promise<string[]> {
    if (!emailBody || emailBody.trim().length === 0) {
      return [];
    }

    // Strip HTML tags if present and reduce content length (3000 instead of 4000)
    const textContent = emailBody.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    // Do not summarize emails shorter than 500 characters
    if (textContent.length < 500) {
      return [];
    }

    const contentPreview = textContent.substring(0, 3000);

    const prompt = `Summarize into 3 bullet points (JSON array only):
["point 1", "point 2", "point 3"]

Email: ${contentPreview}`;

    try {
      await this.waitForRateLimit();
      const response = await this.executeWithRetry(async () => {
        return await this.client.chat.completions.create({
          model: this.SIMPLE_TASK_MODEL, // GPT-3.5 is sufficient for summarization
          messages: [
            {
              role: 'system',
              content: 'Respond with only a JSON array of 3 summary strings.'
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.5,
          max_tokens: 200, // Limit response length
        });
      });

      const content = response.choices[0].message.content;
      if (!content) {
        return [];
      }

      // Try to parse JSON array
      const bullets = JSON.parse(content.trim());
      if (Array.isArray(bullets) && bullets.length === 3) {
        return bullets.filter((bullet: any) => typeof bullet === 'string' && bullet.trim().length > 0);
      }

      return [];
    } catch (error) {
      console.error('Error generating email summary:', error);
      // Return empty array on error - don't fail the request
      return [];
    }
  }
}

export const openAIService = new OpenAIService();
