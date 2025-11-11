import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { openAIRateLimiter } from '../utils/rateLimiter.js';

export interface SendPromptAnalysis {
  summary: string;
  intent: string;
  targetCompany?: string;
  targetDomain?: string;
  targetPersona?: string;
  tone?: string;
  searchQuery: string;
  keyFacts: string[];
}

export interface SendPlanContactContext {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  lastInteraction?: string | null;
}

export interface SendPlanItemContext {
  id: string;
  type?: string | null;
  title?: string | null;
  description?: string | null;
  tags?: string[] | null;
  url?: string | null;
  attachments?: Array<{
    filename: string;
    mimetype?: string;
    size?: number;
  }> | null;
}

export interface SendPlanRecommendation {
  subject: string;
  body: string;
  recommendedContactId?: string | null;
  recommendedContactEmail?: string | null;
  contactReason?: string | null;
  attachments: Array<{
    itemId: string;
    attachmentFilename?: string | null;
    reason?: string | null;
  }>;
  notes?: string | null;
  confidence?: number | null;
  followUpTasks?: string[] | null;
  suggestedSearchQuery?: string | null;
}

dotenv.config();

export class OpenAIService {
  private client: OpenAI;
  private readonly EMBEDDING_MODEL: string;

  private readonly SIMPLE_TASK_MODEL = 'gpt-3.5-turbo'; // For simple tasks (10-30x cheaper than GPT-4)
  private readonly ADVANCED_TASK_MODEL = 'gpt-4-turbo-preview'; // For complex tasks that need GPT-4
  private readonly VISION_MODEL = 'gpt-4o'; // For vision tasks (supports image analysis)

  constructor() {
    this.EMBEDDING_MODEL = this.resolveEmbeddingModel();
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Log model configuration
    console.log(`[OpenAI] Using embedding model: ${this.EMBEDDING_MODEL}`);
    console.log(`[OpenAI] Using chat model (simple): ${this.SIMPLE_TASK_MODEL}`);
    console.log(`[OpenAI] Using chat model (advanced): ${this.ADVANCED_TASK_MODEL}`);
    console.log(`[OpenAI] Using vision model: ${this.VISION_MODEL}`);
  }

  private resolveEmbeddingModel(): string {
    const configured = process.env.OPENAI_EMBEDDING_MODEL?.trim();

    if (!configured) {
      return 'text-embedding-3-small';
    }

    const normalized = configured.toLowerCase();
    if (normalized === 'small' || normalized === 'text-embedding-3-small') {
      return 'text-embedding-3-small';
    }
    if (normalized === 'large' || normalized === 'text-embedding-3-large') {
      return 'text-embedding-3-large';
    }
    return configured;
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
   * Generate title and description from an image using Vision API
   */
  async generateImageDescriptionAndTitle(imagePath: string, filename?: string): Promise<{ title: string; description: string }> {
    try {
      // Read image file and convert to base64
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // Determine MIME type from file extension
      const ext = path.extname(imagePath).toLowerCase();
      let mimeType = 'image/jpeg'; // default
      if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.gif') mimeType = 'image/gif';
      else if (ext === '.webp') mimeType = 'image/webp';
      else if (ext === '.bmp') mimeType = 'image/bmp';
      else if (ext === '.tiff' || ext === '.tif') mimeType = 'image/tiff';

      const prompt = `Analyze this image and provide a title and description. Respond with JSON only:
{
  "title": "3-10 word descriptive title",
  "description": "1-2 sentence description of what's in the image, max 200 chars"
}`;

      await this.waitForRateLimit();
      const response = await this.executeWithRetry(async () => {
        return await this.client.chat.completions.create({
          model: this.VISION_MODEL,
          messages: [
            { role: 'system', content: 'Respond with valid JSON only.' },
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
          temperature: 0.5,
          max_tokens: 200, // Limit response length
          response_format: { type: 'json_object' },
        });
      });

      const content = response.choices[0].message.content;
      if (!content) {
        // Fallback to filename-based title
        const fallbackTitle = filename ? path.basename(filename, path.extname(filename)) : 'Untitled Image';
        return {
          title: fallbackTitle,
          description: 'Image description unavailable',
        };
      }

      try {
        const parsed = JSON.parse(content);
        return {
          title: parsed.title || (filename ? path.basename(filename, path.extname(filename)) : 'Untitled Image'),
          description: parsed.description || 'Image description unavailable',
        };
      } catch (error) {
        // Fallback if JSON parsing fails
        const fallbackTitle = filename ? path.basename(filename, path.extname(filename)) : 'Untitled Image';
        return {
          title: fallbackTitle,
          description: 'Image description unavailable',
        };
      }
    } catch (error: any) {
      console.error(`[OpenAI] Error generating image description:`, error);
      // Fallback to filename-based title
      const fallbackTitle = filename ? path.basename(filename, path.extname(filename)) : 'Untitled Image';
      return {
        title: fallbackTitle,
        description: 'Image description unavailable',
      };
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

  async processTaskPrompt(
    prompt: string,
    item: any,
    task: any,
    fileContent?: string
  ): Promise<{ itemUpdates: Record<string, unknown>; taskUpdates: Record<string, unknown> }> {
    // Placeholder implementation – extend with OpenAI powered updates as needed
    console.log('[OpenAI] processTaskPrompt invoked', {
      prompt,
      itemId: item?.id,
      taskId: task?.id,
      hasFileContent: Boolean(fileContent),
    });

    return {
      itemUpdates: {},
      taskUpdates: {},
    };
  }

  async analyzeSendPrompt(prompt: string): Promise<SendPromptAnalysis> {
    const instruction = `You help a user draft outreach emails. Analyze the request and respond with JSON only:
{
  "summary": "short summary of what the user wants",
  "intent": "primary goal (e.g. introduction, follow-up, pitch, update)",
  "targetCompany": "company name if obvious else empty string",
  "targetDomain": "domain like example.com without protocol or empty string",
  "targetPersona": "intended recipient persona/job role if inferred else empty string",
  "tone": "suggested tone adjective such as friendly, formal, persuasive",
  "searchQuery": "succinct search query to find supporting materials",
  "keyFacts": ["bullet", "points", "max 4"]
}

User request: ${prompt}`;

    await this.waitForRateLimit();
    const response = await this.executeWithRetry(async () => {
      return await this.client.chat.completions.create({
        model: this.SIMPLE_TASK_MODEL,
        messages: [
          { role: 'system', content: 'Respond with concise JSON respecting camelCase keys.' },
          { role: 'user', content: instruction },
        ],
        temperature: 0.3,
        max_tokens: 250,
        response_format: { type: 'json_object' },
      });
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        summary: prompt.slice(0, 120),
        intent: 'general',
        searchQuery: prompt.slice(0, 100),
        keyFacts: [],
      };
    }

    try {
      const parsed = JSON.parse(content);
      return {
        summary: typeof parsed.summary === 'string' ? parsed.summary : prompt.slice(0, 120),
        intent: typeof parsed.intent === 'string' ? parsed.intent : 'general',
        targetCompany: typeof parsed.targetCompany === 'string' ? parsed.targetCompany || undefined : undefined,
        targetDomain: typeof parsed.targetDomain === 'string' ? parsed.targetDomain || undefined : undefined,
        targetPersona: typeof parsed.targetPersona === 'string' ? parsed.targetPersona || undefined : undefined,
        tone: typeof parsed.tone === 'string' ? parsed.tone || undefined : undefined,
        searchQuery: typeof parsed.searchQuery === 'string' && parsed.searchQuery.trim().length > 0
          ? parsed.searchQuery
          : prompt.slice(0, 100),
        keyFacts: Array.isArray(parsed.keyFacts)
          ? parsed.keyFacts
              .filter((fact: unknown): fact is string => typeof fact === 'string' && fact.trim().length > 0)
              .slice(0, 4)
          : [],
      };
    } catch (error) {
      console.warn('[OpenAI] Failed to parse send prompt analysis JSON', error);
      return {
        summary: prompt.slice(0, 120),
        intent: 'general',
        searchQuery: prompt.slice(0, 100),
        keyFacts: [],
      };
    }
  }

  async generateSendPlan(input: {
    prompt: string;
    analysis: SendPromptAnalysis;
    contacts: SendPlanContactContext[];
    items: SendPlanItemContext[];
  }): Promise<SendPlanRecommendation> {
    const { prompt, analysis } = input;

    const trimmedContacts = input.contacts.slice(0, 8).map((contact) => ({
      id: contact.id,
      name: contact.name ?? null,
      email: contact.email ?? null,
      phone: contact.phone ?? null,
      company: contact.company ?? null,
      lastInteraction: contact.lastInteraction ?? null,
    }));

    const trimmedItems = input.items.slice(0, 8).map((item) => ({
      id: item.id,
      type: item.type ?? null,
      title: item.title ?? null,
      description: item.description ? item.description.slice(0, 400) : null,
      tags: item.tags?.slice(0, 6) ?? null,
      url: item.url ?? null,
      attachments: item.attachments?.slice(0, 3) ?? null,
    }));

    const payload = {
      prompt,
      analysis,
      contacts: trimmedContacts,
      items: trimmedItems,
    };

    const instruction = `You assist the user in preparing an email. Review the JSON context and respond strictly with JSON:
{
  "subject": "recommended subject line",
  "body": "multiline email body with placeholders already filled",
  "recommendedContactId": "id from contacts array or empty string",
  "recommendedContactEmail": "email from contacts array or empty string",
  "contactReason": "brief justification",
  "attachments": [
    {
      "itemId": "id from items array",
      "attachmentFilename": "filename if needed else empty string",
      "reason": "why this helps"
    }
  ],
  "notes": "additional suggestions or follow-up reminders",
  "confidence": 0.0-1.0 number,
  "followUpTasks": ["optional checklist"],
  "suggestedSearchQuery": "refined search query for more context"
}

Return valid JSON only.`;

    await this.waitForRateLimit();
    const response = await this.executeWithRetry(async () => {
      return await this.client.chat.completions.create({
        model: this.ADVANCED_TASK_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert outreach assistant. Always return valid JSON matching the requested schema.',
          },
          {
            role: 'user',
            content: `${instruction}\n\nContext:\n${JSON.stringify(payload, null, 2)}`,
          },
        ],
        temperature: 0.6,
        max_tokens: 650,
        response_format: { type: 'json_object' },
      });
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        subject: analysis.summary.slice(0, 60) || 'Draft Email',
        body: `Hi,\n\n${analysis.summary}\n\nBest regards,\n`,
        attachments: [],
        notes: null,
        confidence: null,
        recommendedContactId: null,
        recommendedContactEmail: null,
        contactReason: null,
        followUpTasks: null,
        suggestedSearchQuery: null,
      };
    }

    try {
      const parsed = JSON.parse(content);
      return {
        subject: typeof parsed.subject === 'string' && parsed.subject.trim() ? parsed.subject.trim() : 'Draft Email',
        body: typeof parsed.body === 'string' && parsed.body.trim()
          ? parsed.body.trim()
          : `Hi,\n\n${analysis.summary}\n\nBest regards,\n`,
        recommendedContactId: typeof parsed.recommendedContactId === 'string' && parsed.recommendedContactId
          ? parsed.recommendedContactId
          : null,
        recommendedContactEmail:
          typeof parsed.recommendedContactEmail === 'string' && parsed.recommendedContactEmail
            ? parsed.recommendedContactEmail
            : null,
        contactReason:
          typeof parsed.contactReason === 'string' && parsed.contactReason.trim()
            ? parsed.contactReason.trim()
            : null,
        attachments: Array.isArray(parsed.attachments)
          ? parsed.attachments
              .filter(
                (att: unknown): att is { itemId: string; attachmentFilename?: string | null; reason?: string | null } =>
                  typeof att === 'object' &&
                  att !== null &&
                  typeof (att as any).itemId === 'string' &&
                  (att as any).itemId.trim().length > 0
              )
              .map((att: any) => ({
                itemId: att.itemId,
                attachmentFilename:
                  typeof att.attachmentFilename === 'string' && att.attachmentFilename.trim().length > 0
                    ? att.attachmentFilename.trim()
                    : null,
                reason: typeof att.reason === 'string' && att.reason.trim().length > 0 ? att.reason.trim() : null,
              }))
              .slice(0, 5)
          : [],
        notes: typeof parsed.notes === 'string' && parsed.notes.trim() ? parsed.notes.trim() : null,
        confidence:
          typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
            ? Math.min(Math.max(parsed.confidence, 0), 1)
            : null,
        followUpTasks: Array.isArray(parsed.followUpTasks)
          ? parsed.followUpTasks
              .filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
              .slice(0, 5)
          : null,
        suggestedSearchQuery:
          typeof parsed.suggestedSearchQuery === 'string' && parsed.suggestedSearchQuery.trim()
            ? parsed.suggestedSearchQuery.trim()
            : null,
      };
    } catch (error) {
      console.warn('[OpenAI] Failed to parse send plan JSON', error);
      return {
        subject: analysis.summary.slice(0, 60) || 'Draft Email',
        body: `Hi,\n\n${analysis.summary}\n\nBest regards,\n`,
        attachments: [],
        notes: null,
        confidence: null,
        recommendedContactId: null,
        recommendedContactEmail: null,
        contactReason: null,
        followUpTasks: null,
        suggestedSearchQuery: null,
      };
    }
  }
}

export const openAIService = new OpenAIService();
