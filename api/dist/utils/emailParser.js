export class EmailParser {
    static parse(resendPayload) {
        return {
            subject: resendPayload.subject || '',
            body: resendPayload.html || resendPayload.text || '',
            from: this.extractEmail(resendPayload.from),
            to: this.extractEmail(resendPayload.to),
            attachments: (resendPayload.attachments || []).map((att) => ({
                filename: att.filename,
                content_type: att.content_type,
                size: att.size,
                url: att.url,
            })),
        };
    }
    static extractEmail(emailString) {
        if (!emailString)
            return '';
        const match = emailString.match(/<(.+)>/);
        return match ? match[1] : emailString;
    }
}
export const emailParser = new EmailParser();
//# sourceMappingURL=emailParser.js.map