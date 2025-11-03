import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type { Query } from '@brain/shared';

export interface NLQResult {
  sql?: string;
  queryType: 'sql' | 'aggregation' | 'filter';
  dataSources: string[];
  description: string;
}

export class NLQService {
  private openai?: OpenAI;
  private anthropic?: Anthropic;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }

    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }
  }

  async translateQuery(
    naturalLanguageQuery: string,
    availableSchemas: Array<{ name: string; columns: string[] }>
  ): Promise<NLQResult> {
    // Use OpenAI or Anthropic to translate natural language to SQL
    const provider = this.openai || this.anthropic;

    if (!provider) {
      throw new Error('No AI provider configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY');
    }

    const schemaContext = availableSchemas.map((schema) =>
      `Table: ${schema.name}\nColumns: ${schema.columns.join(', ')}`
    ).join('\n\n');

    const prompt = `You are a SQL query translator. Convert the following natural language query into SQL.

Available schemas:
${schemaContext}

Natural language query: "${naturalLanguageQuery}"

Return a JSON object with:
- sql: The SQL query
- queryType: One of "sql", "aggregation", or "filter"
- dataSources: Array of table names used
- description: Human-readable description of what the query does

Only return valid JSON.`;

    try {
      if (this.openai) {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'You are a SQL query translator. Return only valid JSON.' },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
        });

        const result = JSON.parse(completion.choices[0].message.content || '{}');
        return result as NLQResult;
      } else if (this.anthropic) {
        const message = await this.anthropic.messages.create({
          model: 'claude-3-opus-20240229',
          max_tokens: 1024,
          messages: [
            { role: 'user', content: prompt },
          ],
        });

        const content = message.content[0];
        if (content.type === 'text') {
          const result = JSON.parse(content.text);
          return result as NLQResult;
        }
      }
    } catch (error) {
      console.error('NLQ translation error:', error);
      throw new Error(`Failed to translate query: ${error}`);
    }

    throw new Error('Failed to translate query');
  }

  async generateInsights(data: unknown[]): Promise<Array<{
    type: 'anomaly' | 'trend' | 'forecast';
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
  }>> {
    // Simple rule-based insights for MVP
    const insights = [];

    if (data.length === 0) {
      return insights;
    }

    // Analyze data for patterns
    // This is simplified - in production, use proper ML models

    // Check for anomalies (values > 2 standard deviations)
    const numericColumns = this.extractNumericColumns(data);
    for (const [column, values] of Object.entries(numericColumns)) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);

      const anomalies = values.filter(val => Math.abs(val - mean) > 2 * stdDev);
      if (anomalies.length > 0) {
        insights.push({
          type: 'anomaly' as const,
          title: `Anomaly detected in ${column}`,
          description: `${anomalies.length} values are outside normal range`,
          severity: 'medium' as const,
        });
      }
    }

    return insights;
  }

  private extractNumericColumns(data: unknown[]): Record<string, number[]> {
    const numericColumns: Record<string, number[]> = {};

    if (data.length === 0) return numericColumns;

    const firstRow = data[0] as Record<string, unknown>;

    for (const [key, value] of Object.entries(firstRow)) {
      if (typeof value === 'number') {
        numericColumns[key] = data
          .map(row => (row as Record<string, unknown>)[key] as number)
          .filter(val => typeof val === 'number');
      }
    }

    return numericColumns;
  }
}
