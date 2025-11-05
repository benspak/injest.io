import express from 'express';
import { UserModel } from '../models/User.js';
import { ItemModel } from '../models/Item.js';
import { indexingService } from '../services/indexing.js';
const router = express.Router();
// Resend inbound webhook
router.post('/inbound', async (req, res) => {
    try {
        // Resend webhook format
        const { from, to, subject, text, html, attachments } = req.body;
        if (!from || !to || !subject) {
            return res.status(400).json({ error: 'Missing required email fields' });
        }
        // Extract email address from "Name <email>" format
        const fromEmail = from.includes('<')
            ? from.match(/<(.+)>/)?.[1] || from
            : from;
        // Find user by email
        const user = await UserModel.findByEmail(fromEmail);
        if (!user) {
            console.log(`Email from unregistered user: ${fromEmail}`);
            return res.status(404).json({ error: 'User not found' });
        }
        if (!user.verified) {
            console.log(`Email from unverified user: ${fromEmail}`);
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
            source: `email:${fromEmail}`,
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
export default router;
//# sourceMappingURL=email.js.map