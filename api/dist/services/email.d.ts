import type { Item } from '../models/Item.js';
export interface ReceivedEmail {
    id: string;
    to: string[];
    from: string;
    created_at: string;
    subject: string;
    bcc?: string[];
    cc?: string[];
    reply_to?: string[];
    message_id?: string;
    html?: string;
    text?: string;
    headers?: Record<string, string>;
    attachments?: EmailAttachment[];
}
export interface EmailAttachment {
    id: string;
    filename: string;
    size: number;
    content_type: string;
    content_disposition?: string;
    content_id?: string | null;
    download_url?: string;
    expires_at?: string;
}
export interface ReceivedEmailListResponse {
    object: string;
    has_more: boolean;
    data: ReceivedEmail[];
}
export declare class EmailService {
    private resend;
    constructor();
    sendMagicLink(email: string, magicLink: string): Promise<void>;
    sendApprovalEmail(email: string): Promise<void>;
    sendFeedbackEmail(params: {
        title: string;
        message: string;
        userEmail?: string;
        to?: string;
        image?: {
            buffer: Buffer;
            originalname: string;
            mimetype: string;
        };
    }): Promise<void>;
    sendItemShareEmail(params: {
        to: string;
        item: Item;
        shareUrl: string;
        senderEmail?: string;
    }): Promise<void>;
    listReceivedEmails(limit?: number, after?: string, before?: string): Promise<ReceivedEmailListResponse>;
    getReceivedEmail(emailId: string): Promise<ReceivedEmail>;
    listEmailAttachments(emailId: string): Promise<{
        object: string;
        has_more: boolean;
        data: EmailAttachment[];
    }>;
    getEmailAttachment(emailId: string, attachmentId: string): Promise<Blob>;
}
export declare const emailService: EmailService;
//# sourceMappingURL=email.d.ts.map