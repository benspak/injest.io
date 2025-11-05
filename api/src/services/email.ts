import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const RESEND_API_BASE = 'https://api.resend.com';

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

export class EmailService {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  async sendMagicLink(email: string, magicLink: string): Promise<void> {
    await this.resend.emails.send({
      from: 'Injest <noreply@injest.io>',
      to: email,
      subject: 'Sign in to Injest.io',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to Injest.io</h2>
          <p>Click the link below to sign in to your account:</p>
          <p><a href="${magicLink}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">Sign In</a></p>
          <p>This link will expire in 7 days.</p>
          <p>If you didn't request this email, you can safely ignore it.</p>
        </div>
      `,
    });
  }

  async sendApprovalEmail(email: string): Promise<void> {
    await this.resend.emails.send({
      from: 'Injest <noreply@injest.io>',
      to: email,
      subject: 'Your email has been approved for Injest.io',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Email Approved</h2>
          <p>Your email address has been approved. You can now send emails to <strong>input@injest.io</strong> to add items to your knowledge base.</p>
          <p>Happy organizing!</p>
        </div>
      `,
    });
  }

  async listReceivedEmails(limit?: number, after?: string, before?: string): Promise<ReceivedEmailListResponse> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (after) params.append('after', after);
    if (before) params.append('before', before);

    const queryString = params.toString();
    const url = `${RESEND_API_BASE}/emails/receiving${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch emails' })) as { error?: string };
      throw new Error(error.error || `Failed to fetch emails: ${response.status}`);
    }

    return await response.json() as ReceivedEmailListResponse;
  }

  async getReceivedEmail(emailId: string): Promise<ReceivedEmail> {
    const url = `${RESEND_API_BASE}/emails/receiving/${emailId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch email' })) as { error?: string };
      throw new Error(error.error || `Failed to fetch email: ${response.status}`);
    }

    const result = await response.json() as { data?: ReceivedEmail } | ReceivedEmail;
    // Handle both wrapped and unwrapped responses
    if ('data' in result && result.data) {
      return result.data;
    }
    return result as ReceivedEmail;
  }

  async listEmailAttachments(emailId: string): Promise<{ object: string; has_more: boolean; data: EmailAttachment[] }> {
    const url = `${RESEND_API_BASE}/emails/receiving/${emailId}/attachments`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch attachments' })) as { error?: string };
      throw new Error(error.error || `Failed to fetch attachments: ${response.status}`);
    }

    return await response.json() as { object: string; has_more: boolean; data: EmailAttachment[] };
  }

  async getEmailAttachment(emailId: string, attachmentId: string): Promise<Blob> {
    const url = `${RESEND_API_BASE}/emails/receiving/${emailId}/attachments/${attachmentId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
    });

    if (!response.ok) {
      const error = await response.text().catch(() => 'Failed to fetch attachment');
      throw new Error(`Failed to fetch attachment: ${response.status} - ${error}`);
    }

    return response.blob();
  }
}

export const emailService = new EmailService();
