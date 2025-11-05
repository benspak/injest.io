export declare class OpenAIService {
    private client;
    constructor();
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
}
export declare const openAIService: OpenAIService;
//# sourceMappingURL=openai.d.ts.map