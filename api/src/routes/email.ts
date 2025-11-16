import express from 'express';
import { UserModel, type User } from '../models/User.js';
import { ItemModel } from '../models/Item.js';
import { ItemAccessModel } from '../models/ItemAccess.js';
import { emailParser } from '../utils/emailParser.js';
import { indexingService } from '../services/indexing.js';
import { emailService } from '../services/email.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { openAIService } from '../services/openai.js';
import { ContactModel } from '../models/Contact.js';
import { contactStreamService } from '../services/contactStream.js';

const router = express.Router();

// Helper function to normalize an email address
function normalizeEmailAddress(email: string): string {
  return email.trim().toLowerCase();
}

// Helper function to extract local part and domain from an email address
function parseEmailAddress(address: string): { localPart: string; domain: string } | null {
  if (!address) {
    return null;
  }
  const trimmed = address.trim();
  const match = trimmed.match(/<?([^<>@\s]+)@([^<>@\s]+)>?$/);
  if (!match) {
    return null;
  }
  // Support plus-addressing: username+tag@injest.io -> username
  const rawLocal = match[1] || '';
  const plusIndex = rawLocal.indexOf('+');
  const localPart = (plusIndex >= 0 ? rawLocal.slice(0, plusIndex) : rawLocal).toLowerCase();
  const domain = match[2].toLowerCase();
  return { localPart, domain };
}

// Helper function to resolve the owning user for an inbound address like username@injest.io
async function resolveInboundUserForAddress(address: string): Promise<User | null> {
  const parsed = parseEmailAddress(address);
  if (!parsed) {
    return null;
  }

  const { localPart, domain } = parsed;

  const inboundDomain = (process.env.INBOUND_EMAIL_DOMAIN || 'injest.io').toLowerCase();

  if (domain !== inboundDomain) {
    return null;
  }

  // 1) Prefer mapping local-part to public_username
  const byUsername = await UserModel.findByPublicUsername(localPart);
  if (byUsername) {
    return byUsername;
  }

  // 2) Fallback: if the full address matches a user's login email
  const fullAddress = `${localPart}@${domain}`;
  const byEmail = await UserModel.findByEmail(fullAddress);
  if (byEmail) {
    return byEmail;
  }

  return null;
}

// Helper function to save email from Resend format to database
async function saveEmailFromResend(email: any, userId: string): Promise<any> {
  // Extract email address from "from" field
  let fromEmail = email.from;
  if (fromEmail.includes('<')) {
    fromEmail = fromEmail.match(/<(.+)>/)?.[1] || fromEmail;
  }
  const normalizedFromEmail = normalizeEmailAddress(fromEmail);

  // Normalize the "to" field
  const toAddresses = Array.isArray(email.to) ? email.to : [email.to];

  // Process attachments
  const attachmentsData = (email.attachments || []).map((att: any) => ({
    filename: att.filename,
    originalname: att.filename,
    mimetype: att.content_type,
    size: att.size,
    url: att.download_url || att.url,
    id: att.id,
  }));

  // Create raw content with Resend email ID
  const rawContent = JSON.stringify({
    resend_email_id: email.id,
    subject: email.subject,
    body: email.html || email.text || '',
    from: fromEmail,
    to: toAddresses,
    created_at: email.created_at,
    attachments: attachmentsData,
    headers: email.headers,
    message_id: email.message_id,
  });

  // Create item
  const item = await ItemModel.create({
    owner_id: userId,
    type: 'email',
    title: email.subject,
    description: email.html || email.text || '',
    attachments: attachmentsData.length > 0 ? attachmentsData : undefined,
    raw: rawContent,
    source: `email:${normalizedFromEmail}`,
  });

  // Trigger indexing in background for auto-tagging and categorization
  indexingService.indexItem(item).catch(console.error);

  // Upsert contact for the sender (best-effort; failures shouldn't block email ingestion)
  try {
    const contact = await ContactModel.upsert({
      ownerId: userId,
      email: normalizedFromEmail,
      sourceItemId: item.id,
      metadata: {
        ...(email.headers || {}),
        source: 'email_inbound',
        from: fromEmail,
        to: toAddresses,
        created_at: email.created_at,
        resend_email_id: email.id,
      },
    });

    if (contact) {
      contactStreamService.broadcastContacts([contact]);
      await indexingService.indexContact(contact);
    }
  } catch (error) {
    console.warn('[Email] Failed to upsert contact from Resend email:', {
      userId,
      error,
    });
  }

  return item;
}

// Resend inbound webhook
router.post('/inbound', async (req: express.Request, res: express.Response) => {
  try {
    // Resend webhook format
    const { from, to, subject, text, html, attachments } = req.body;

    if (!from || !to || !subject) {
      return res.status(400).json({ error: 'Missing required email fields' });
    }
    // Normalize the "to" field - it can be a string or array
    const toAddressesRaw = Array.isArray(to) ? to : [to];
    const normalizedToAddresses = toAddressesRaw.map((addr: string) =>
      normalizeEmailAddress(addr.includes('<') ? (addr.match(/<(.+)>/)?.[1] || addr) : addr)
    );

    // First, try per-user routing based on username@injest.io
    let user = null;
    for (const addr of normalizedToAddresses) {
      const resolved = await resolveInboundUserForAddress(addr);
      if (resolved) {
        user = resolved;
        break;
      }
    }

    // Backwards-compatible fallback: legacy single inbox address that routes by sender email
    if (!user) {
      const receivingEmail = (process.env.RECEIVING_EMAIL || 'input@injest.io').toLowerCase();
      const wasSentToLegacyInbox = normalizedToAddresses.some(
        (addr: string) => addr === receivingEmail
      );

      if (!wasSentToLegacyInbox) {
        console.log(
          `[Email] Inbound email not routed: no matching username address or legacy inbox. To: ${normalizedToAddresses.join(
            ', '
          )}`
        );
        return res.status(404).json({ error: 'No matching inbox for recipient addresses' });
      }

      // Legacy behaviour: map user by sender email
      const fromEmailForLookup = from.includes('<')
        ? from.match(/<(.+)>/)?.[1] || from
        : from;
      const normalizedFromForLookup = normalizeEmailAddress(fromEmailForLookup);
      user = await UserModel.findByEmail(normalizedFromForLookup);

      if (!user) {
        console.log(`[Email] Legacy inbound email from unregistered user: ${normalizedFromForLookup}`);
        return res.status(404).json({ error: 'User not found for legacy inbox' });
      }
    }

    if (!user.verified) {
      console.log(`[Email] Inbound email for unverified user: ${user.email}`);
      return res.status(403).json({ error: 'User email not verified' });
    }

    // Extract email address from "Name <email>" format for sender
    const fromEmail = from.includes('<')
      ? from.match(/<(.+)>/)?.[1] || from
      : from;

    const normalizedFromEmail = normalizeEmailAddress(fromEmail);
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
    // Include any email ID from webhook if available
    const rawContent = JSON.stringify({
      resend_email_id: req.body.id || req.body.message_id || null,
      subject,
      body: html || text || '',
      from: fromEmail,
      to,
      attachments: attachmentsData,
      created_at: req.body.created_at || new Date().toISOString(),
      headers: req.body.headers,
      message_id: req.body.message_id,
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
    indexingService.indexItem(item).catch(console.error);

    // Upsert a simple contact for the sender
    try {
      const contact = await ContactModel.upsert({
        ownerId: user.id,
        email: normalizedFromEmail,
        sourceItemId: item.id,
        metadata: {
          source: 'email_inbound',
          from: fromEmail,
          to: normalizedToAddresses,
          subject,
          created_at: req.body.created_at || new Date().toISOString(),
        },
      });

      if (contact) {
        contactStreamService.broadcastContacts([contact]);
        await indexingService.indexContact(contact);
      }
    } catch (error) {
      console.warn('[Email] Failed to upsert contact from inbound webhook email:', {
        userId: user.id,
        error,
      });
    }

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

    // Always fetch from Resend to sync any new emails (with reasonable limit)
    const syncLimit = limit || 50; // Sync up to 50 emails at a time
    const response = await emailService.listReceivedEmails(syncLimit, after, before);

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

    // Save each email to database and index them (if not already saved)
    for (const email of filteredEmails) {
      // Check if email already exists in database (including deleted items)
      const existingItem = await ItemModel.findByResendEmailId(email.id);
      if (!existingItem) {
        // Save new email to database (indexing happens automatically)
        await saveEmailFromResend(email, req.user.id);
      } else if (existingItem.deleted_at) {
        // Email was previously deleted - don't re-index it, just skip
        console.log(`Skipping previously deleted email: ${email.id}`);
      }
      // If item exists and is not deleted, it's already in the database, so skip
    }

    // Get all emails from database (including newly saved ones)
    const allDbItems = await ItemModel.findByOwnerAndType(req.user.id, 'email', limit || 100, 0);

    // Convert all DB items to Resend-like format
    const allEmailItems = allDbItems.map((item) => {
      let rawData: any = {};
      try {
        rawData = item.raw ? JSON.parse(item.raw) : {};
      } catch {
        // If raw is not JSON, use defaults
      }

      // Extract email addresses from source field
      const sourceMatch = item.source?.match(/email:(.+)/);
      const fromEmail = sourceMatch ? sourceMatch[1] : '';

      return {
        id: rawData.resend_email_id || item.id,
        to: rawData.to || [],
        from: fromEmail,
        created_at: rawData.created_at || item.created_at,
        subject: item.title || rawData.subject || '',
        html: item.description || rawData.body || '',
        text: rawData.body || item.description || '',
        attachments: item.attachments || [],
        headers: rawData.headers,
        message_id: rawData.message_id,
      };
    });

    // Sort by created_at descending (most recent first)
    allEmailItems.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });

    // Apply limit if specified
    const limitedItems = limit ? allEmailItems.slice(0, limit) : allEmailItems;

    // Return all emails from database
    res.json({
      object: 'list',
      has_more: false,
      data: limitedItems,
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

    // First check if email exists in database
    let item = await ItemModel.findByResendEmailId(emailId);

    if (item) {
      // Verify ownership or shared access
      const hasAccess =
        item.owner_id === req.user.id ||
        (await ItemAccessModel.userHasAccess(item.id, req.user.id, req.user.email));

      if (!hasAccess) {
        return res.status(403).json({ error: 'Email not found or access denied' });
      }

      // Convert item to Resend-like format
      let rawData: any = {};
      try {
        rawData = item.raw ? JSON.parse(item.raw) : {};
      } catch {
        // If raw is not JSON, use defaults
      }

      // Extract email addresses from source field
      const sourceMatch = item.source?.match(/email:(.+)/);
      const fromEmail = sourceMatch ? sourceMatch[1] : '';

      const emailResponse = {
        id: rawData.resend_email_id || item.id,
        to: rawData.to || [],
        from: fromEmail,
        created_at: rawData.created_at || item.created_at,
        subject: item.title || rawData.subject || '',
        html: item.description || rawData.body || '',
        text: rawData.body || item.description || '',
        attachments: item.attachments || [],
        headers: rawData.headers,
        message_id: rawData.message_id,
      };

      return res.json(emailResponse);
    }

    // If not in database, fetch from Resend
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

    // Save email to database and index it
    const savedItem = await saveEmailFromResend(email, req.user.id);
    if (!savedItem) {
      return res.status(500).json({ error: 'Failed to save email' });
    }

    // Convert saved item to Resend-like format
    let rawData: any = {};
    try {
      rawData = savedItem.raw ? JSON.parse(savedItem.raw) : {};
    } catch {
      // If raw is not JSON, use defaults
    }

    const sourceMatch = savedItem.source?.match(/email:(.+)/);
    const fromEmailFinal = sourceMatch ? sourceMatch[1] : '';

    const emailResponse = {
      id: rawData.resend_email_id || savedItem.id,
      to: rawData.to || [],
      from: fromEmailFinal,
      created_at: rawData.created_at || savedItem.created_at,
      subject: savedItem.title || rawData.subject || '',
      html: savedItem.description || rawData.body || '',
      text: rawData.body || savedItem.description || '',
      attachments: savedItem.attachments || [],
      headers: rawData.headers,
      message_id: rawData.message_id,
    };

    res.json(emailResponse);
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

// Generate and save email summary (3 bullet points)
router.post('/received/:emailId/summary', authMiddleware, async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const emailId = req.params.emailId;

    // Find the item in database by Resend email ID
    let item = await ItemModel.findByResendEmailId(emailId);

    if (!item) {
      // If not in database, fetch from Resend and save it
      const email = await emailService.getReceivedEmail(emailId);

      // Verify ownership
      const userEmail = req.user.email.toLowerCase();
      let fromEmail = email.from;
      if (fromEmail.includes('<')) {
        fromEmail = fromEmail.match(/<(.+)>/)?.[1] || fromEmail;
      }
      const normalizedFromEmail = fromEmail.toLowerCase().trim();

      if (normalizedFromEmail !== userEmail) {
        return res.status(403).json({ error: 'Email not found or access denied' });
      }

      // Save email to database
      item = await saveEmailFromResend(email, req.user.id);
      if (!item) {
        return res.status(500).json({ error: 'Failed to save email' });
      }
    }

    // Verify ownership
    if (item.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Email not found or access denied' });
    }

    // Check if summary already exists in clean field
    if (item.clean) {
      try {
        const existingSummary = JSON.parse(item.clean);
        if (Array.isArray(existingSummary) && existingSummary.length > 0) {
          return res.json({ summary: existingSummary });
        }
      } catch {
        // If clean field exists but isn't valid JSON, continue to generate new summary
      }
    }

    // Get email body (prefer text, fallback to HTML)
    let emailBody = item.description || '';

    // If description is empty, try to extract from raw field
    if (!emailBody || emailBody.trim().length === 0) {
      try {
        if (item.raw) {
          const rawData = JSON.parse(item.raw);
          emailBody = rawData.body || rawData.text || rawData.html || '';
        }
      } catch {
        // If raw parsing fails, continue
      }
    }

    // If still empty, try to fetch from Resend again
    if (!emailBody || emailBody.trim().length === 0) {
      try {
        const email = await emailService.getReceivedEmail(emailId);
        emailBody = email.text || email.html || '';

        // Update the item with the email body if we found it
        if (emailBody && emailBody.trim().length > 0) {
          await ItemModel.update(item.id, { description: emailBody });
        }
      } catch (error) {
        console.error('Error fetching email from Resend:', error);
      }
    }

    // If email body is still empty after all attempts, return error
    if (!emailBody || emailBody.trim().length === 0) {
      return res.status(400).json({
        error: 'Email body is empty. Cannot generate summary for an email without content.'
      });
    }

    // Check if email is too short to summarize (less than 500 characters)
    const textContent = emailBody.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (textContent.length < 500) {
      return res.json({ summary: [] });
    }

    // Generate summary
    const summary = await openAIService.generateEmailSummary(emailBody);

    if (summary.length === 0) {
      return res.status(500).json({ error: 'Failed to generate summary' });
    }

    // Save summary to database in clean field as JSON string
    const summaryJson = JSON.stringify(summary);
    await ItemModel.update(item.id, { clean: summaryJson });

    res.json({ summary });
  } catch (error) {
    console.error('Error generating email summary:', error);
    res.status(500).json({ error: 'Failed to generate email summary' });
  }
});

export default router;
