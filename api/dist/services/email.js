import { Resend } from 'resend';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import crypto from 'crypto';
import { fileStorageService } from './storage.js';
import { markdownToEmailHtml, htmlToPlainText } from '../utils/markdownToEmail.js';
dotenv.config();
const RESEND_API_BASE = 'https://api.resend.com';
export class EmailService {
    resend;
    constructor() {
        this.resend = new Resend(process.env.RESEND_API_KEY);
    }
    /**
     * Helper to build a friendly From header while keeping reply routing simple.
     * If a senderName is provided, we use "Name <email>", otherwise just the email.
     */
    buildFromAddress(email, senderName) {
        const trimmedEmail = email.trim();
        const safeName = senderName?.trim();
        if (!safeName) {
            return trimmedEmail;
        }
        return `${safeName} <${trimmedEmail}>`;
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
          <p>Your email address has been approved. You can now send emails to your personal Injest address (for example, <strong>username@injest.io</strong>) to add items to your knowledge base.</p>
          <p>Happy organizing!</p>
        </div>
      `,
        });
    }
    async sendPasswordResetEmail(to, resetLink, accountEmail) {
        const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Reset Your Password</h2>
        <p>Hello,</p>
        <p>We received a request to reset the password for your Injest.io account (${accountEmail}).</p>
        <p>Click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Reset Password</a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #6b7280; font-size: 14px;">${resetLink}</p>
        <p style="color: #6b7280; font-size: 14px;">This link will expire in 1 hour.</p>
        <p>If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.</p>
        <p>Best regards,<br>The Injest.io Team</p>
      </div>
    `;
        const text = `
Reset Your Password

Hello,

We received a request to reset the password for your Injest.io account (${accountEmail}).

Click the link below to reset your password:
${resetLink}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.

Best regards,
The Injest.io Team
    `;
        await this.resend.emails.send({
            from: 'Injest <noreply@injest.io>',
            to,
            subject: 'Reset Your Injest.io Password',
            html,
            text,
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
    async sendItemShareEmail(params) {
        const { to, item, shareUrl, senderEmail, senderName } = params;
        const escapeHtml = (value) => value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        const formatSection = (label, value) => {
            if (!value || value.trim().length === 0) {
                return '';
            }
            return `
        <div style="margin-bottom: 12px;">
          <div style="font-weight: 600; margin-bottom: 4px;">${label}</div>
          <div style="white-space: pre-wrap; line-height: 1.5;">${escapeHtml(value)}</div>
        </div>
      `;
        };
        const title = item.title || 'Untitled item';
        const descriptionSection = formatSection('Description', item.description || item.clean);
        const notesSection = formatSection('Notes', item.notes);
        const attachmentsList = Array.isArray(item.attachments) && item.attachments.length > 0
            ? `
          <div style="margin-bottom: 12px;">
            <div style="font-weight: 600; margin-bottom: 4px;">Attachments</div>
            <ul style="margin: 0; padding-left: 18px;">
              ${item.attachments
                .map((attachment) => `<li>${escapeHtml(attachment.originalname || attachment.filename)}</li>`)
                .join('')}
            </ul>
          </div>
        `
            : '';
        const tagsList = Array.isArray(item.tags) && item.tags.length > 0
            ? `
          <div style="margin-bottom: 12px;">
            <div style="font-weight: 600; margin-bottom: 4px;">Tags</div>
            <div>${item.tags.map((tag) => `<span style="display: inline-block; background-color: #eef2ff; color: #3730a3; padding: 2px 8px; border-radius: 12px; margin-right: 6px; margin-bottom: 6px;">${escapeHtml(tag)}</span>`).join('')}</div>
          </div>
        `
            : '';
        const urlSection = item.url
            ? `
        <div style="margin-bottom: 12px;">
          <div style="font-weight: 600; margin-bottom: 4px;">Source URL</div>
          <a href="${escapeHtml(item.url)}" style="color: #2563eb; text-decoration: none;">${escapeHtml(item.url)}</a>
        </div>
      `
            : '';
        const metadataSection = item.link_metadata?.description && (!item.description || item.description.trim().length === 0)
            ? formatSection('Summary', item.link_metadata.description)
            : '';
        const sharedBy = senderEmail ? escapeHtml(senderEmail) : null;
        const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
        <p style="margin-bottom: 16px;">${sharedBy ? `${sharedBy} shared an item with you.` : 'An item has been shared with you.'}</p>
        <h2 style="font-size: 20px; margin-bottom: 16px;">${escapeHtml(title)}</h2>
        ${descriptionSection}
        ${metadataSection}
        ${urlSection}
        ${notesSection}
        ${attachmentsList}
        ${tagsList}
        <div style="margin-top: 24px;">
          <a href="${escapeHtml(shareUrl)}" style="display: inline-block; padding: 10px 16px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">View item on Injest</a>
        </div>
      </div>
    `;
        const textSections = [
            sharedBy ? `${sharedBy} shared an item with you.` : 'An item has been shared with you.',
            `Title: ${title}`,
        ];
        if (item.description || item.clean) {
            textSections.push(`Description:\n${item.description || item.clean}`);
        }
        if (item.link_metadata?.description && !item.description) {
            textSections.push(`Summary:\n${item.link_metadata.description}`);
        }
        if (item.url) {
            textSections.push(`Source URL: ${item.url}`);
        }
        if (item.notes) {
            textSections.push(`Notes:\n${item.notes}`);
        }
        let emailAttachments;
        if (Array.isArray(item.attachments) && item.attachments.length > 0) {
            textSections.push(`Attachments:\n${item.attachments
                .map((attachment) => `- ${attachment.originalname || attachment.filename}`)
                .join('\n')}`);
            const preparedAttachments = [];
            for (const attachment of item.attachments) {
                if (!attachment?.filename) {
                    continue;
                }
                const storedFilename = attachment.filename;
                const downloadName = attachment.originalname || attachment.filename;
                const contentType = attachment.mimetype || 'application/octet-stream';
                try {
                    const filePath = fileStorageService.getFilePath(storedFilename);
                    const fileBuffer = await fs.readFile(filePath);
                    preparedAttachments.push({
                        filename: downloadName,
                        content: fileBuffer.toString('base64'),
                        contentType,
                    });
                }
                catch (error) {
                    console.warn('[EmailService] Failed to load attachment for sharing email', {
                        filename: storedFilename,
                        error,
                    });
                }
            }
            if (preparedAttachments.length > 0) {
                emailAttachments = preparedAttachments;
            }
        }
        if (Array.isArray(item.tags) && item.tags.length > 0) {
            textSections.push(`Tags: ${item.tags.join(', ')}`);
        }
        textSections.push(`View item: ${shareUrl}`);
        const text = textSections.join('\n\n');
        // Prefer sending from the user's injest.io address when available so replies go back to them.
        // Fall back to the configured share-from address or noreply for safety.
        const defaultFrom = process.env.ITEM_SHARE_FROM_EMAIL || 'Injest <noreply@injest.io>';
        const fromAddress = senderEmail && senderEmail.trim().length > 0
            ? this.buildFromAddress(senderEmail, senderName ?? null)
            : defaultFrom;
        await this.resend.emails.send({
            from: fromAddress,
            to,
            subject: `Shared item: ${title}`,
            html,
            text,
            attachments: emailAttachments,
        });
    }
    async sendComposedEmail(params) {
        const { to, subject, bodyHtml, bodyText, cc, bcc, replyTo, attachments, fromEmail, } = params;
        if (!to || !to.trim()) {
            throw new Error('Recipient email is required to send composed email');
        }
        if (!subject || !subject.trim()) {
            throw new Error('Subject is required to send composed email');
        }
        // Use the caller-provided fromEmail when available so replies go back to the user.
        // Fall back to the configured outbound sender or noreply for system-driven messages.
        const defaultFrom = process.env.OUTBOUND_SEND_EMAIL || 'Injest <noreply@injest.io>';
        const fromAddress = fromEmail && fromEmail.trim().length > 0
            ? this.buildFromAddress(fromEmail, undefined)
            : defaultFrom;
        const emailSignature = '-- Email generated via Injest.io --';
        const emailSignatureHtml = '<p style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">-- Email generated via Injest.io --</p>';
        let htmlContent;
        let textContent;
        if (bodyHtml) {
            // If HTML is explicitly provided, use it as-is
            htmlContent = bodyHtml;
            textContent = htmlToPlainText(bodyHtml);
        }
        else if (bodyText) {
            // Convert Markdown to HTML with email-compatible inline styles
            htmlContent = markdownToEmailHtml(bodyText);
            // Generate plain text fallback from the HTML
            textContent = htmlToPlainText(htmlContent);
        }
        else {
            // Empty content
            htmlContent = '<p></p>';
            textContent = '';
        }
        let preparedAttachments;
        const imageContentIds = [];
        if (attachments && attachments.length > 0) {
            preparedAttachments = [];
            for (const attachment of attachments) {
                if (!attachment?.storedFilename) {
                    continue;
                }
                const filePath = fileStorageService.getFilePath(attachment.storedFilename);
                const fileBuffer = await fs.readFile(filePath);
                const mimetype = attachment.mimetype || 'application/octet-stream';
                const isImage = mimetype.startsWith('image/');
                // Generate contentId for image attachments to enable inline previews
                let contentId;
                if (isImage) {
                    try {
                        contentId = crypto.randomUUID();
                    }
                    catch {
                        // Fallback for older Node versions
                        contentId = crypto.randomBytes(16).toString('hex');
                    }
                    imageContentIds.push({
                        contentId,
                        filename: attachment.displayName || attachment.storedFilename,
                    });
                }
                const attachmentPayload = {
                    filename: attachment.displayName || attachment.storedFilename,
                    content: fileBuffer.toString('base64'),
                    contentType: mimetype,
                };
                if (contentId) {
                    attachmentPayload.contentId = contentId;
                }
                preparedAttachments.push(attachmentPayload);
            }
            if (preparedAttachments.length === 0) {
                preparedAttachments = undefined;
            }
        }
        // Embed image attachments in HTML as inline previews using cid: references
        if (imageContentIds.length > 0) {
            const imageHtml = imageContentIds
                .map(({ contentId, filename }) => `<div style="margin: 10px 0;"><img src="cid:${contentId}" alt="${filename.replace(/"/g, '&quot;')}" style="max-width: 100%; height: auto;" /></div>`)
                .join('\n');
            htmlContent = `${htmlContent}\n${imageHtml}`;
        }
        // Append signature to HTML content (after attachments)
        htmlContent = `${htmlContent}${emailSignatureHtml}`;
        // Append signature to text content
        textContent = textContent ? `${textContent}\n\n${emailSignature}` : emailSignature;
        // Resend's runtime API supports `replyTo`, but TypeScript typings may lag behind.
        // We use `replyTo` here and cast the payload to `any` to avoid over-constraining the type.
        const emailPayload = {
            from: fromAddress,
            to,
            cc,
            bcc,
            replyTo: replyTo || undefined,
            subject,
            html: htmlContent,
            text: textContent,
            attachments: preparedAttachments,
        };
        await this.resend.emails.send(emailPayload);
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
    async getEmailAttachment(emailId, attachmentId, retries = 2) {
        const url = `${RESEND_API_BASE}/emails/receiving/${emailId}/attachments/${attachmentId}`;
        let lastError = null;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                    },
                });
                if (!response.ok) {
                    // For 5xx errors, retry if we have attempts left
                    if (response.status >= 500 && response.status < 600 && attempt < retries) {
                        const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff, max 5s
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                    // Try to parse error as JSON first, fall back to text
                    let errorMessage;
                    const contentType = response.headers.get('content-type') || '';
                    if (contentType.includes('application/json')) {
                        try {
                            const errorJson = await response.json();
                            errorMessage = errorJson.error || errorJson.message || `HTTP ${response.status}`;
                        }
                        catch {
                            errorMessage = `HTTP ${response.status}`;
                        }
                    }
                    else {
                        // For HTML errors (like Cloudflare 500 pages), extract a concise message
                        const errorText = await response.text().catch(() => '');
                        if (errorText.includes('<!DOCTYPE html>') || errorText.includes('<html')) {
                            // Extract title or error code from HTML if possible
                            const titleMatch = errorText.match(/<title[^>]*>([^<]+)<\/title>/i);
                            const errorCodeMatch = errorText.match(/Error code (\d+)/i);
                            errorMessage = titleMatch
                                ? `${titleMatch[1]}${errorCodeMatch ? ` (${errorCodeMatch[1]})` : ''}`
                                : `HTTP ${response.status} - Server error`;
                        }
                        else {
                            // Limit error text length to avoid logging huge responses
                            errorMessage = errorText.length > 200
                                ? `${errorText.substring(0, 200)}...`
                                : errorText || `HTTP ${response.status}`;
                        }
                    }
                    // For 4xx errors, don't retry - these are client errors
                    if (response.status >= 400 && response.status < 500) {
                        throw new Error(`Failed to fetch attachment: ${response.status} - ${errorMessage}`);
                    }
                    // For other errors, store and potentially retry
                    lastError = new Error(`Failed to fetch attachment: ${response.status} - ${errorMessage}`);
                    if (attempt < retries) {
                        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                    throw lastError;
                }
                return response.blob();
            }
            catch (error) {
                lastError = error;
                // Check if this is a network error or retryable error
                const isNetworkError = error?.name === 'TypeError' || error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT';
                const isRetryable = isNetworkError || (error?.message && error.message.includes('500'));
                // If this is the last attempt or not a retryable error, throw
                if (attempt === retries || !isRetryable) {
                    throw error;
                }
                // Otherwise, wait and retry
                const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        // Should never reach here, but TypeScript needs it
        throw lastError || new Error('Failed to fetch attachment after retries');
    }
}
export const emailService = new EmailService();
//# sourceMappingURL=email.js.map