import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set');
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EMBEDDING_MODEL = 'text-embedding-ada-002';
const GPT_MODEL = 'gpt-4-turbo-preview';

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });

  return response.data[0].embedding;
}

export async function generateCompletion(
  prompt: string,
  context?: string
): Promise<string> {
  const messages = [
    {
      role: 'system' as const,
      content: context
        ? `You are a helpful AI assistant. Use the following context to answer questions:\n\n${context}`
        : 'You are a helpful AI assistant.',
    },
    {
      role: 'user' as const,
      content: prompt,
    },
  ];

  const response = await openai.chat.completions.create({
    model: GPT_MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 1000,
  });

  return response.choices[0].message.content || '';
}

export async function classifyAndExtract(text: string): Promise<{
  type: string;
  tags: string[];
  summary: string;
  title: string;
}> {
  const prompt = `Analyze this content and return JSON with:
- type: one of "note", "link", "file", "email", "task", "chat"
- tags: array of relevant tags (max 5)
- summary: 1-2 sentence summary
- title: short title (max 60 chars)

Content: ${text.substring(0, 2000)}`;

  const response = await generateCompletion(prompt);

  try {
    const parsed = JSON.parse(response);
    return {
      type: parsed.type || 'note',
      tags: parsed.tags || [],
      summary: parsed.summary || text.substring(0, 200),
      title: parsed.title || text.substring(0, 60),
    };
  } catch {
    // Fallback if JSON parsing fails
    return {
      type: 'note',
      tags: [],
      summary: text.substring(0, 200),
      title: text.substring(0, 60),
    };
  }
}
