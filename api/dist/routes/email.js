import express from 'express';
import { UserModel } from '../models/User.js';
import { ItemModel } from '../models/Item.js';
import { indexingService } from '../services/indexing.js';
import { emailService } from '../services/email.js';
import { authMiddleware } from '../middleware/auth.js';
import { openAIService } from '../services/openai.js';
const router = express.Router();
// Helper function to save email from Resend format to database
async function saveEmailFromResend(email, userId) {
    // Extract email address from "from" field
    let fromEmail = email.from;
    if (fromEmail.includes('<')) {
        fromEmail = fromEmail.match(/<(.+)>/)?.[1] || fromEmail;
    }
    const normalizedFromEmail = fromEmail.toLowerCase().trim();
    // Normalize the "to" field
    const toAddresses = Array.isArray(email.to) ? email.to : [email.to];
    // Process attachments
    const attachmentsData = (email.attachments || []).map((att) => ({
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
    indexingService.indexItem(item.id).catch(console.error);
    return item;
}
// Resend inbound webhook
router.post('/inbound', async (req, res) => {
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
        const normalizedToAddresses = toAddresses.map((addr) => {
            if (addr.includes('<')) {
                return addr.match(/<(.+)>/)?.[1] || addr.toLowerCase().trim();
            }
            return addr.toLowerCase().trim();
        });
        // Verify that the email was sent to the correct receiving address
        const isSentToReceivingAddress = normalizedToAddresses.some((addr) => addr === receivingEmail.toLowerCase());
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
        const attachmentsData = (attachments || []).map((att) => ({
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
        indexingService.indexItem(item.id).catch(console.error);
        res.json({
            message: 'Email processed successfully',
            itemId: item.id,
        });
    }
    catch (error) {
        console.error('Error processing email:', error);
        res.status(500).json({ error: 'Failed to process email' });
    }
});
// Get list of received emails from Resend
router.get('/received', authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
        const after = req.query.after;
        const before = req.query.before;
        // Always fetch from Resend to sync any new emails (with reasonable limit)
        const syncLimit = limit || 50; // Sync up to 50 emails at a time
        const response = await emailService.listReceivedEmails(syncLimit, after, before);
        // Filter emails to only show those sent FROM the authenticated user's email
        const userEmail = req.user.email.toLowerCase();
        const filteredEmails = (response.data || []).filter((email) => {
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
            // Check if email already exists in database
            const existingItem = await ItemModel.findByResendEmailId(email.id);
            if (!existingItem) {
                // Save new email to database (indexing happens automatically)
                await saveEmailFromResend(email, req.user.id);
            }
        }
        // Get all emails from database (including newly saved ones)
        const allDbItems = await ItemModel.findByOwnerAndType(req.user.id, 'email', limit || 100, 0);
        // Convert all DB items to Resend-like format
        const allEmailItems = allDbItems.map((item) => {
            let rawData = {};
            try {
                rawData = item.raw ? JSON.parse(item.raw) : {};
            }
            catch {
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
    }
    catch (error) {
        console.error('Error fetching received emails:', error);
        res.status(500).json({ error: 'Failed to fetch received emails' });
    }
});
// Get a single received email from Resend
router.get('/received/:id', authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const emailId = req.params.id;
        // First check if email exists in database
        let item = await ItemModel.findByResendEmailId(emailId);
        if (item) {
            // Verify ownership
            if (item.owner_id !== req.user.id) {
                return res.status(403).json({ error: 'Email not found or access denied' });
            }
            // Convert item to Resend-like format
            let rawData = {};
            try {
                rawData = item.raw ? JSON.parse(item.raw) : {};
            }
            catch {
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
        let rawData = {};
        try {
            rawData = savedItem.raw ? JSON.parse(savedItem.raw) : {};
        }
        catch {
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
    }
    catch (error) {
        console.error('Error fetching received email:', error);
        res.status(500).json({ error: 'Failed to fetch received email' });
    }
});
// Get attachments for a received email
router.get('/received/:id/attachments', authMiddleware, async (req, res) => {
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
    }
    catch (error) {
        console.error('Error fetching email attachments:', error);
        res.status(500).json({ error: 'Failed to fetch email attachments' });
    }
});
// Get a specific attachment for a received email
router.get('/received/:emailId/attachments/:attachmentId', authMiddleware, async (req, res) => {
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
    }
    catch (error) {
        console.error('Error fetching email attachment:', error);
        res.status(500).json({ error: 'Failed to fetch email attachment' });
    }
});
// Generate and save email summary (3 bullet points)
router.post('/received/:emailId/summary', authMiddleware, async (req, res) => {
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
            }
            catch {
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
            }
            catch {
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
            }
            catch (error) {
                console.error('Error fetching email from Resend:', error);
            }
        }
        // If email body is still empty after all attempts, return error
        if (!emailBody || emailBody.trim().length === 0) {
            return res.status(400).json({
                error: 'Email body is empty. Cannot generate summary for an email without content.'
            });
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
    }
    catch (error) {
        console.error('Error generating email summary:', error);
        res.status(500).json({ error: 'Failed to generate email summary' });
    }
});
export default router;
//# sourceMappingURL=email.js.map