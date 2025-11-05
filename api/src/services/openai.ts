import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export class OpenAIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async createEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-large',
      input: text,
    });

    return response.data[0].embedding;
  }

  async classifyAndTag(text: string): Promise<{ type: string; category: string; tags: string[]; summary: string }> {
    const prompt = `Analyze the following content and provide:
1. Type: one of (note, link, file, email, task)
2. Category: a brief category name
3. Tags: array of 3-5 relevant tags
4. Summary: a concise summary (max 200 characters)

Content: ${text.substring(0, 2000)}

Respond in JSON format:
{
  "type": "...",
  "category": "...",
  "tags": ["tag1", "tag2", ...],
  "summary": "..."
}`;

    const response = await this.client.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: 'You are a content classification assistant. Always respond with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
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
    const messages: any[] = [
      { role: 'system', content: 'You are a helpful assistant that generates content based on user context.' },
    ];

    if (context) {
      messages.push({ role: 'system', content: `Context: ${context}` });
    }

    messages.push({ role: 'user', content: prompt });

    const response = await this.client.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages,
      temperature: 0.7,
    });

    return response.choices[0].message.content || '';
  }

  /**
   * Generate a title and description from file content
   */
  async generateTitleAndDescription(fileContent: string, filename?: string): Promise<{ title: string; description: string }> {
    // Limit content length to avoid token limits (keep first 4000 chars)
    const contentPreview = fileContent.substring(0, 4000);

    const prompt = `Based on the following file content${filename ? ` from file "${filename}"` : ''}, generate:
1. A concise, descriptive title (3-10 words, no quotes)
2. A brief description (1-2 sentences, max 200 characters)

File content:
${contentPreview}

Respond in JSON format:
{
  "title": "...",
  "description": "..."
}`;

    const response = await this.client.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that generates titles and descriptions from file content. Always respond with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
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

    // Limit content length to avoid token limits (keep first 2000 chars)
    const contentPreview = content.substring(0, 2000);

    const prompt = `Analyze the following content and generate 3-5 relevant tags that best describe it.
Tags should be concise (1-3 words each), lowercase, and descriptive of the content's topic or category.

Content: ${contentPreview}

Respond with only a JSON array of tag strings, no other text:
["tag1", "tag2", "tag3"]`;

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a content tagging assistant. Always respond with only a valid JSON array of tag strings, nothing else.'
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
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

    // Strip HTML tags if present and limit content length
    const textContent = emailBody.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const contentPreview = textContent.substring(0, 4000);

    const prompt = `Summarize the following email body into exactly 3 concise bullet points. Each bullet point should be a single sentence that captures a key point or action item from the email.

Email body:
${contentPreview}

Respond with only a JSON array of exactly 3 strings, no other text:
["bullet point 1", "bullet point 2", "bullet point 3"]`;

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an email summarization assistant. Always respond with only a valid JSON array of exactly 3 summary bullet points, nothing else.'
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.5,
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
