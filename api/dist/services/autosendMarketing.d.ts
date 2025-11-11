export interface AutoSendSender {
    id: string;
    name: string;
    email: string;
    status?: string;
    created_at?: string;
    updated_at?: string;
    [key: string]: unknown;
}
export interface AutoSendContact {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    tags?: string[];
    status?: string;
    custom_fields?: Record<string, unknown>;
    subscribed_at?: string | null;
    unsubscribed_at?: string | null;
    [key: string]: unknown;
}
export interface AutoSendCampaign {
    id: string;
    name: string;
    subject: string;
    sender_id: string;
    audience_id?: string;
    status?: string;
    preview_text?: string | null;
    html?: string | null;
    text?: string | null;
    scheduled_at?: string | null;
    created_at?: string;
    updated_at?: string;
    [key: string]: unknown;
}
export interface AutoSendPaginatedResponse<T> {
    object?: 'list';
    has_more?: boolean;
    next_cursor?: string | null;
    data: T[];
}
export interface UpsertContactInput {
    email: string;
    firstName?: string;
    lastName?: string;
    tags?: string[];
    customFields?: Record<string, unknown>;
    subscribed?: boolean;
    listId?: string;
}
export interface CreateSenderInput {
    name: string;
    email: string;
    replyTo?: string;
    previewText?: string;
}
export interface CreateCampaignInput {
    name: string;
    subject: string;
    html: string;
    text?: string;
    senderId?: string;
    audienceId?: string;
    previewText?: string;
    sendAt?: string | null;
    listId?: string;
}
declare class AutoSendMarketingService {
    private readonly apiKey;
    private readonly apiBase;
    private readonly defaultSenderId?;
    private readonly defaultListId?;
    constructor();
    getPreferredSenderId(): string | undefined;
    getPreferredListId(): string | undefined;
    private request;
    listSenders(): Promise<AutoSendPaginatedResponse<AutoSendSender>>;
    createSender(payload: CreateSenderInput): Promise<AutoSendSender>;
    listContacts(params?: {
        limit?: number;
        cursor?: string;
        listId?: string;
    }): Promise<AutoSendPaginatedResponse<AutoSendContact>>;
    upsertContact(input: UpsertContactInput): Promise<AutoSendContact>;
    listCampaigns(params?: {
        limit?: number;
        cursor?: string;
        status?: string;
    }): Promise<AutoSendPaginatedResponse<AutoSendCampaign>>;
    createCampaign(payload: CreateCampaignInput): Promise<AutoSendCampaign>;
    scheduleCampaign(campaignId: string, sendAt: string): Promise<AutoSendCampaign>;
    sendCampaignNow(campaignId: string): Promise<{
        status: string;
    }>;
    cancelCampaign(campaignId: string): Promise<{
        status: string;
    }>;
}
export declare const autosendMarketingService: AutoSendMarketingService;
export {};
//# sourceMappingURL=autosendMarketing.d.ts.map