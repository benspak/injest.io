import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

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
}

export const emailService = new EmailService();
