export interface ParsedEmail {
    subject: string;
    body: string;
    from: string;
    to: string;
    attachments: Array<{
        filename: string;
        content_type: string;
        size: number;
        url?: string;
    }>;
}
export declare class EmailParser {
    static parse(resendPayload: any): ParsedEmail;
    private static extractEmail;
}
export declare const emailParser: EmailParser;
//# sourceMappingURL=emailParser.d.ts.map