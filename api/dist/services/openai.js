import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config();
export class OpenAIService {
    client;
    constructor() {
        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }
    async createEmbedding(text) {
        const response = await this.client.embeddings.create({
            model: 'text-embedding-3-large',
            input: text,
        });
        return response.data[0].embedding;
    }
    async classifyAndTag(text) {
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
        }
        catch (error) {
            // Fallback if JSON parsing fails
            return {
                type: 'note',
                category: 'general',
                tags: [],
                summary: text.substring(0, 200),
            };
        }
    }
    async generate(prompt, context) {
        const messages = [
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
    async generateTitleAndDescription(fileContent, filename) {
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
        }
        catch (error) {
            // Fallback if JSON parsing fails
            const fallbackTitle = filename ? path.basename(filename, path.extname(filename)) : 'Untitled Document';
            return {
                title: fallbackTitle,
                description: fileContent.substring(0, 200).trim() || 'No description available',
            };
        }
    }
    /**
     * Process a task prompt to update item and task details
     * @param userPrompt The user's instruction (e.g., "Parse the document and leave a more comprehensive description")
     * @param item The item associated with the task
     * @param task The task to update
     * @param fileContent Optional parsed file content if item has attachments
     */
    async processTaskPrompt(userPrompt, item, task, fileContent) {
        // Build context from item and task
        let context = `Task Title: ${task.title || 'Untitled'}
Task Description: ${task.description || 'None'}
Task Status: ${task.status}

Item Type: ${item.type || 'unknown'}
Item Title: ${item.title || 'None'}
Item Description: ${item.description || 'None'}
Item URL: ${item.url || 'None'}
Item Notes: ${item.notes || 'None'}
`;
        // Add file content if available
        if (fileContent) {
            // Limit file content to avoid token limits
            const contentPreview = fileContent.substring(0, 8000);
            context += `\n\nFile Content:\n${contentPreview}`;
        }
        else if (item.raw) {
            try {
                const parsed = JSON.parse(item.raw);
                context += `\n\nRaw Item Data:\n${JSON.stringify(parsed, null, 2).substring(0, 4000)}`;
            }
            catch {
                context += `\n\nRaw Item Content:\n${item.raw.substring(0, 4000)}`;
            }
        }
        const systemPrompt = `You are an intelligent assistant that helps manage tasks and their associated items. 
When given a user instruction about a task, you should:
1. Analyze the item content (which may include file content, URLs, notes, etc.)
2. Understand what the user wants you to do based on their prompt
3. Return JSON with updated fields for both the item and the task

Always respond with valid JSON in this exact format:
{
  "itemUpdates": {
    "title": "updated title or null if no change",
    "description": "updated description or null if no change",
    "notes": "updated notes or null if no change"
  },
  "taskUpdates": {
    "title": "updated title or null if no change",
    "description": "updated description or null if no change"
  }
}

Important:
- Only include fields that should be updated (omit fields that shouldn't change)
- If a field shouldn't change, set it to null or omit it
- Be thorough and comprehensive when the user asks for improvements
- Preserve important information from the original content
- Make descriptions more detailed when requested`;
        const userMessage = `User instruction: ${userPrompt}

Current context:
${context}

Based on the user's instruction, provide updated fields for the item and task in JSON format.`;
        const response = await this.client.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage },
            ],
            temperature: 0.5,
        });
        const content = response.choices[0].message.content;
        if (!content) {
            throw new Error('No response from OpenAI');
        }
        try {
            // Try to extract JSON from markdown code blocks if present
            let jsonContent = content.trim();
            const jsonMatch = jsonContent.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
            if (jsonMatch) {
                jsonContent = jsonMatch[1];
            }
            const result = JSON.parse(jsonContent);
            // Clean up null values - convert to undefined so fields can be omitted
            const cleanUpdates = (updates) => {
                const cleaned = {};
                for (const [key, value] of Object.entries(updates || {})) {
                    if (value !== null && value !== undefined) {
                        cleaned[key] = value;
                    }
                }
                return cleaned;
            };
            return {
                itemUpdates: cleanUpdates(result.itemUpdates || {}),
                taskUpdates: cleanUpdates(result.taskUpdates || {}),
            };
        }
        catch (error) {
            console.error('Error parsing OpenAI response:', error);
            console.error('Response content:', content);
            throw new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
export const openAIService = new OpenAIService();
//# sourceMappingURL=openai.js.map