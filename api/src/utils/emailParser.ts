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

export class EmailParser {
  static parse(resendPayload: any): ParsedEmail {
    return {
      subject: resendPayload.subject || '',
      body: resendPayload.html || resendPayload.text || '',
      from: this.extractEmail(resendPayload.from),
      to: this.extractEmail(resendPayload.to),
      attachments: (resendPayload.attachments || []).map((att: any) => ({
        filename: att.filename,
        content_type: att.content_type,
        size: att.size,
        url: att.url,
      })),
    };
  }

  private static extractEmail(emailString: string): string {
    if (!emailString) return '';
    const match = emailString.match(/<(.+)>/);
    return match ? match[1] : emailString;
  }
}

export const emailParser = new EmailParser();
