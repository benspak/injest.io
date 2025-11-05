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
     * Process a task prompt to update item and task details
     * @param userPrompt The user's instruction (e.g., "Parse the document and leave a more comprehensive description")
     * @param item The item associated with the task
     * @param task The task to update
     * @param fileContent Optional parsed file content if item has attachments
     */
    processTaskPrompt(userPrompt: string, item: any, task: any, fileContent?: string): Promise<{
        itemUpdates: Partial<any>;
        taskUpdates: Partial<any>;
    }>;
}
export declare const openAIService: OpenAIService;
//# sourceMappingURL=openai.d.ts.map