import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: text,
  });

  return response.data[0].embedding;
}

export async function classifyAndStructure(content: string): Promise<{
  type: 'note' | 'link' | 'file' | 'email';
  tags: string[];
  summary: string;
}> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: `Classify and structure the following content. Return JSON with:
- type: one of "note", "link", "file", "email"
- tags: array of 3-5 relevant tags
- summary: concise summary (max 200 chars)

Content:`,
      },
      {
        role: 'user',
        content: content.substring(0, 4000), // Limit input length
      },
    ],
    response_format: { type: 'json_object' },
  });

  const result = JSON.parse(response.choices[0].message.content || '{}');

  return {
    type: result.type || 'note',
    tags: result.tags || [],
    summary: result.summary || content.substring(0, 200),
  };
}

export async function generateContextualResponse(
  prompt: string,
  context: string[]
): Promise<string> {
  const contextText = context.join('\n\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: `You are a helpful assistant that generates responses based on the user's knowledge base. Use the following context to inform your response:\n\n${contextText}`,
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  return response.choices[0].message.content || '';
}
