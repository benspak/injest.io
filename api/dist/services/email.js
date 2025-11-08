import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();
const RESEND_API_BASE = 'https://api.resend.com';
export class EmailService {
    resend;
    constructor() {
        this.resend = new Resend(process.env.RESEND_API_KEY);
    }
    async sendMagicLink(email, magicLink) {
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
    async sendApprovalEmail(email) {
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
    async sendFeedbackEmail(params) {
        const { title, message, userEmail, to, image } = params;
        const escapeHtml = (value) => value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        const feedbackTitle = title.trim();
        const feedbackMessage = message.trim();
        const sender = userEmail ?? 'Unknown user';
        const htmlBody = `
      <p>You have received new feedback from <strong>${escapeHtml(sender)}</strong>.</p>
      <p><strong>Title:</strong> ${escapeHtml(feedbackTitle)}</p>
      <p><strong>Message:</strong></p>
      <p>${escapeHtml(feedbackMessage).replace(/\n/g, '<br />')}</p>
      ${image ? `<p><em>An image attachment is included.</em></p>` : ''}
    `;
        const textBody = [
            `New feedback from: ${sender}`,
            `Title: ${feedbackTitle}`,
            'Message:',
            feedbackMessage,
            image ? '\nAn image attachment is included.' : '',
        ]
            .filter(Boolean)
            .join('\n\n');
        const attachments = image
            ? [
                {
                    filename: image.originalname,
                    content: image.buffer.toString('base64'),
                    contentType: image.mimetype,
                },
            ]
            : undefined;
        const fromAddress = process.env.FEEDBACK_FROM_EMAIL || 'Injest Feedback <noreply@injest.io>';
        const toAddress = to || process.env.FEEDBACK_RECIPIENT_EMAIL || 'benvspak@gmail.com';
        await this.resend.emails.send({
            from: fromAddress,
            to: toAddress,
            subject: `Feedback: ${feedbackTitle}`,
            html: htmlBody,
            text: textBody,
            attachments,
        });
    }
    async listReceivedEmails(limit, after, before) {
        const params = new URLSearchParams();
        if (limit)
            params.append('limit', limit.toString());
        if (after)
            params.append('after', after);
        if (before)
            params.append('before', before);
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
            const error = await response.json().catch(() => ({ error: 'Failed to fetch emails' }));
            throw new Error(error.error || `Failed to fetch emails: ${response.status}`);
        }
        return await response.json();
    }
    async getReceivedEmail(emailId) {
        const url = `${RESEND_API_BASE}/emails/receiving/${emailId}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to fetch email' }));
            throw new Error(error.error || `Failed to fetch email: ${response.status}`);
        }
        const result = await response.json();
        // Handle both wrapped and unwrapped responses
        if ('data' in result && result.data) {
            return result.data;
        }
        return result;
    }
    async listEmailAttachments(emailId) {
        const url = `${RESEND_API_BASE}/emails/receiving/${emailId}/attachments`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to fetch attachments' }));
            throw new Error(error.error || `Failed to fetch attachments: ${response.status}`);
        }
        return await response.json();
    }
    async getEmailAttachment(emailId, attachmentId) {
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
//# sourceMappingURL=email.js.map