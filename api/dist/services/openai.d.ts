export declare class OpenAIService {
    private client;
    private readonly EMBEDDING_MODEL;
    private readonly SIMPLE_TASK_MODEL;
    private readonly ADVANCED_TASK_MODEL;
    constructor();
    /**
     * Wait for rate limit permission before making API call
     */
    private waitForRateLimit;
    createEmbedding(text: string): Promise<number[]>;
    classifyAndTag(text: string): Promise<{
        type: string;
        category: string;
        tags: string[];
        summary: string;
    }>;
    generate(prompt: string, context?: string): Promise<string>;
    /**
     * Generate a title and description from file content
     */
    generateTitleAndDescription(fileContent: string, filename?: string): Promise<{
        title: string;
        description: string;
    }>;
    /**
     * Generate tags from item content (title, description, notes, etc.)
     */
    generateTags(content: string): Promise<string[]>;
    /**
     * Generate email summary as 3 bullet points
     */
    generateEmailSummary(emailBody: string): Promise<string[]>;
}
export declare const openAIService: OpenAIService;
//# sourceMappingURL=openai.d.ts.map