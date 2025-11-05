import express from 'express';
import { UserModel } from '../models/User.js';
import { ItemModel } from '../models/Item.js';
import { emailParser } from '../utils/emailParser.js';
import { indexingService } from '../services/indexing.js';
import { emailService } from '../services/email.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Resend inbound webhook
router.post('/inbound', async (req: express.Request, res: express.Response) => {
  try {
    // Resend webhook format
    const { from, to, subject, text, html, attachments } = req.body;

    if (!from || !to || !subject) {
      return res.status(400).json({ error: 'Missing required email fields' });
    }

    // Get the receiving email address from environment (default to input@injest.io)
    const receivingEmail = process.env.RECEIVING_EMAIL || 'input@injest.io';

    // Normalize the "to" field - it can be a string or array
    const toAddresses = Array.isArray(to) ? to : [to];

    // Extract email addresses from "Name <email>" format and normalize
    const normalizedToAddresses = toAddresses.map((addr: string) => {
      if (addr.includes('<')) {
        return addr.match(/<(.+)>/)?.[1] || addr.toLowerCase().trim();
      }
      return addr.toLowerCase().trim();
    });

    // Verify that the email was sent to the correct receiving address
    const isSentToReceivingAddress = normalizedToAddresses.some(
      (addr: string) => addr === receivingEmail.toLowerCase()
    );

    if (!isSentToReceivingAddress) {
      console.log(`Email not sent to receiving address. Received at: ${normalizedToAddresses.join(', ')}, Expected: ${receivingEmail}`);
      return res.status(403).json({ error: 'Email not sent to receiving address' });
    }

    // Extract email address from "Name <email>" format
    const fromEmail = from.includes('<')
      ? from.match(/<(.+)>/)?.[1] || from
      : from;

    const normalizedFromEmail = fromEmail.toLowerCase().trim();

    // Find user by email
    const user = await UserModel.findByEmail(normalizedFromEmail);

    if (!user) {
      console.log(`Email from unregistered user: ${normalizedFromEmail}`);
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.verified) {
      console.log(`Email from unverified user: ${normalizedFromEmail}`);
      return res.status(403).json({ error: 'User email not verified' });
    }

    // Parse email content
    const emailContent = {
      subject,
      body: html || text || '',
      attachments: attachments || [],
    };

    // Store attachments info (files would be handled by Resend)
    const attachmentsData = (attachments || []).map((att: any) => ({
      filename: att.filename,
      originalname: att.filename,
      mimetype: att.content_type,
      size: att.size,
      url: att.url,
    }));

    // Create item from email using unified structure
    // Also keep raw for backward compatibility
    const rawContent = JSON.stringify({
      subject,
      body: html || text || '',
      from: fromEmail,
      to,
      attachments: attachmentsData,
    });

    const item = await ItemModel.create({
      owner_id: user.id,
      type: 'email', // Keep type for email distinction
      title: subject,
      description: html || text || '',
      attachments: attachmentsData.length > 0 ? attachmentsData : undefined,
      raw: rawContent, // Keep for backward compatibility
      source: `email:${normalizedFromEmail}`,
    });

    // Trigger indexing in background
    indexingService.indexItem(item.id).catch(console.error);

    res.json({
      message: 'Email processed successfully',
      itemId: item.id,
    });
  } catch (error) {
    console.error('Error processing email:', error);
    res.status(500).json({ error: 'Failed to process email' });
  }
});

// Get list of received emails from Resend
router.get('/received', authMiddleware, async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const after = req.query.after as string | undefined;
    const before = req.query.before as string | undefined;

    // Fetch all emails from Resend
    const response = await emailService.listReceivedEmails(limit, after, before);

    // Filter emails to only show those sent FROM the authenticated user's email
    const userEmail = req.user.email.toLowerCase();
    const filteredEmails = (response.data || []).filter((email: any) => {
      // Extract email address from "from" field - can be "Name <email>" or just "email"
      let fromEmail = email.from;
      if (fromEmail.includes('<')) {
        fromEmail = fromEmail.match(/<(.+)>/)?.[1] || fromEmail;
      }
      const normalizedFromEmail = fromEmail.toLowerCase().trim();

      // Only show emails sent FROM the authenticated user
      return normalizedFromEmail === userEmail;
    });

    // Return filtered response
    res.json({
      ...response,
      data: filteredEmails,
      has_more: false, // We can't determine pagination correctly after filtering
    });
  } catch (error) {
    console.error('Error fetching received emails:', error);
    res.status(500).json({ error: 'Failed to fetch received emails' });
  }
});

// Get a single received email from Resend
router.get('/received/:id', authMiddleware, async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const emailId = req.params.id;
    const email = await emailService.getReceivedEmail(emailId);

    // Verify that the email was sent FROM the authenticated user
    const userEmail = req.user.email.toLowerCase();
    let fromEmail = email.from;
    if (fromEmail.includes('<')) {
      fromEmail = fromEmail.match(/<(.+)>/)?.[1] || fromEmail;
    }
    const normalizedFromEmail = fromEmail.toLowerCase().trim();

    if (normalizedFromEmail !== userEmail) {
      return res.status(403).json({ error: 'Email not found or access denied' });
    }

    res.json(email);
  } catch (error) {
    console.error('Error fetching received email:', error);
    res.status(500).json({ error: 'Failed to fetch received email' });
  }
});

// Get attachments for a received email
router.get('/received/:id/attachments', authMiddleware, async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const emailId = req.params.id;

    // First verify the email belongs to the user (sent FROM the user)
    const email = await emailService.getReceivedEmail(emailId);
    const userEmail = req.user.email.toLowerCase();
    let fromEmail = email.from;
    if (fromEmail.includes('<')) {
      fromEmail = fromEmail.match(/<(.+)>/)?.[1] || fromEmail;
    }
    const normalizedFromEmail = fromEmail.toLowerCase().trim();

    if (normalizedFromEmail !== userEmail) {
      return res.status(403).json({ error: 'Email not found or access denied' });
    }

    const attachments = await emailService.listEmailAttachments(emailId);
    res.json(attachments);
  } catch (error) {
    console.error('Error fetching email attachments:', error);
    res.status(500).json({ error: 'Failed to fetch email attachments' });
  }
});

// Get a specific attachment for a received email
router.get('/received/:emailId/attachments/:attachmentId', authMiddleware, async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { emailId, attachmentId } = req.params;

    // First verify the email belongs to the user (sent FROM the user)
    const email = await emailService.getReceivedEmail(emailId);
    const userEmail = req.user.email.toLowerCase();
    let fromEmail = email.from;
    if (fromEmail.includes('<')) {
      fromEmail = fromEmail.match(/<(.+)>/)?.[1] || fromEmail;
    }
    const normalizedFromEmail = fromEmail.toLowerCase().trim();

    if (normalizedFromEmail !== userEmail) {
      return res.status(403).json({ error: 'Email not found or access denied' });
    }

    const blob = await emailService.getEmailAttachment(emailId, attachmentId);

    // Convert blob to buffer for Express response
    const buffer = Buffer.from(await blob.arrayBuffer());

    // Set appropriate headers
    res.setHeader('Content-Type', blob.type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${attachmentId}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Error fetching email attachment:', error);
    res.status(500).json({ error: 'Failed to fetch email attachment' });
  }
});

export default router;
