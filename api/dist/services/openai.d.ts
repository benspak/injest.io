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
    suggestedSearchQuery?: string | null;
}
export declare class OpenAIService {
    private client;
    private readonly EMBEDDING_MODEL;
    private readonly SIMPLE_TASK_MODEL;
    private readonly ADVANCED_TASK_MODEL;
    private readonly VISION_MODEL;
    constructor();
    private resolveEmbeddingModel;
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
    analyzeSendPrompt(prompt: string): Promise<SendPromptAnalysis>;
    generateSendPlan(input: {
        prompt: string;
        analysis: SendPromptAnalysis;
        contacts: SendPlanContactContext[];
        items: SendPlanItemContext[];
        user?: {
            first_name?: string | null;
            last_name?: string | null;
        };
    }): Promise<SendPlanRecommendation>;
    /**
     * Generate X.com post from email content and prompt
     */
    generateXcomPost(input: {
        prompt: string;
        analysis: SendPromptAnalysis;
        emailBody?: string;
        emailSubject?: string;
        items: SendPlanItemContext[];
        user?: {
            first_name?: string | null;
            last_name?: string | null;
        };
    }): Promise<string>;
}
export declare const openAIService: OpenAIService;
//# sourceMappingURL=openai.d.ts.map