export declare class OpenAIService {
    private client;
    private readonly EMBEDDING_MODEL;
    private readonly SIMPLE_TASK_MODEL;
    private readonly ADVANCED_TASK_MODEL;
    private readonly VISION_MODEL;
    constructor();
    /**
     * Wait for rate limit permission before making API call
     */
    private waitForRateLimit;
    /**
     * Execute OpenAI API call with retry logic for rate limits
     */
    private executeWithRetry;
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
     * Generate title and description from an image using Vision API
     */
    generateImageDescriptionAndTitle(imagePath: string, filename?: string): Promise<{
        title: string;
        description: string;
    }>;
    /**
     * Generate email summary as 3 bullet points
     */
    generateEmailSummary(emailBody: string): Promise<string[]>;
    processTaskPrompt(prompt: string, item: any, task: any, fileContent?: string): Promise<{
        itemUpdates: Record<string, unknown>;
        taskUpdates: Record<string, unknown>;
    }>;
}
export declare const openAIService: OpenAIService;
//# sourceMappingURL=openai.d.ts.map