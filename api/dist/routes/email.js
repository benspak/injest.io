import express from 'express';
import jwt from 'jsonwebtoken';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { UserModel } from '../models/User.js';
import { ItemModel } from '../models/Item.js';
import { indexingService } from '../services/indexing.js';
import { emailService } from '../services/email.js';
import { authMiddleware } from '../middleware/auth.js';
import { openAIService } from '../services/openai.js';
import { ContactModel } from '../models/Contact.js';
import { contactStreamService } from '../services/contactStream.js';
import { JWT_SECRET } from '../config/auth.js';
import { ItemAccessModel } from '../models/ItemAccess.js';
import { normalizeItem, sanitizeOriginalFilename } from '../utils/itemNormalization.js';
import { fileStorageService } from '../services/storage.js';
import { computeFileChecksum } from '../utils/checksum.js';
const router = express.Router();
// Helper function to normalize an email address
function normalizeEmailAddress(email) {
    return email.trim().toLowerCase();
}
// Helper function to extract local part and domain from an email address
function parseEmailAddress(address) {
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
// Helper function to resolve the owning user for an inbound address like handle@injest.io
async function resolveInboundUserForAddress(address) {
    const parsed = parseEmailAddress(address);
    if (!parsed) {
        return null;
    }
    const { localPart, domain } = parsed;
    const inboundDomain = (process.env.INBOUND_EMAIL_DOMAIN || 'injest.io').toLowerCase();
    if (domain !== inboundDomain) {
        return null;
    }
    // 1) Prefer explicit inbound handle mapping
    const byHandle = await UserModel.findByInboundHandle(localPart);
    if (byHandle) {
        return byHandle;
    }
    // 2) Fallback: public_username for backwards compatibility
    const byUsername = await UserModel.findByPublicUsername(localPart);
    if (byUsername) {
        return byUsername;
    }
    // 3) Fallback: if the full address matches a user's login email
    const fullAddress = `${localPart}@${domain}`;
    const byEmail = await UserModel.findByEmail(fullAddress);
    if (byEmail) {
        return byEmail;
    }
    return null;
}
// Helper to generate a unique stored filename for inbound email attachments
function generateUniqueStoredFilename(originalname) {
    const decodedOriginalName = sanitizeOriginalFilename(originalname || 'attachment');
    const ext = path.extname(decodedOriginalName);
    const baseName = path.basename(decodedOriginalName, ext);
    let uniqueId;
    try {
        uniqueId = crypto.randomUUID();
    }
    catch {
        uniqueId = crypto.randomBytes(16).toString('hex');
    }
    const safeBase = sanitizeOriginalFilename(baseName).replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50);
    return `${uniqueId}-${safeBase}${ext}`;
}
// Helper to download and persist a Resend inbound attachment to local storage
async function persistEmailAttachment(att) {
    // Preserve content_id for inline CID images, normalizing by stripping angle brackets
    const rawContentId = att.content_id;
    const normalizedContentId = rawContentId ? rawContentId.replace(/[<>]/g, '') : undefined;
    // Normalize ID fields – prefer explicit id, then attachment_id, then filename
    const id = att.id || att.attachment_id || att.filename;
    const originalname = att.filename || 'attachment';
    const mimetype = att.content_type || 'application/octet-stream';
    const downloadUrl = att.download_url || att.url;
    // If we don't have a download URL, we can't fetch the file – fall back to metadata-only
    if (!downloadUrl) {
        return {
            filename: originalname,
            originalname,
            mimetype,
            size: att.size ?? 0,
            contentId: normalizedContentId,
            id,
        };
    }
    const storedFilename = generateUniqueStoredFilename(originalname);
    const filePath = fileStorageService.getFilePath(storedFilename);
    try {
        const response = await fetch(downloadUrl);
        if (!response.ok) {
            throw new Error(`Failed to download attachment from Resend: ${response.status} ${response.statusText}`);
        }
        // In Node 18+, fetch() returns a web ReadableStream. Instead of piping, read
        // the full body into a Buffer and write it to disk.
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await fs.promises.writeFile(filePath, buffer);
        const size = att.size ?? buffer.length;
        let checksum;
        try {
            checksum = await computeFileChecksum(filePath);
        }
        catch {
            checksum = undefined;
        }
        return {
            filename: storedFilename,
            originalname,
            mimetype,
            size,
            checksum,
            contentId: normalizedContentId,
            id,
        };
    }
    catch (error) {
        console.error('[Email] Failed to persist inbound attachment, falling back to metadata only:', {
            error,
            filename: originalname,
            downloadUrl,
        });
        return {
            filename: originalname,
            originalname,
            mimetype,
            size: att.size ?? 0,
            contentId: normalizedContentId,
            id,
        };
    }
}
// Helper function to save email from Resend format to database
async function saveEmailFromResend(email, userId) {
    // Extract email address from "from" field
    let fromEmail = email.from;
    if (fromEmail.includes('<')) {
        fromEmail = fromEmail.match(/<(.+)>/)?.[1] || fromEmail;
    }
    const normalizedFromEmail = normalizeEmailAddress(fromEmail);
    // Normalize the "to" field
    const toAddresses = Array.isArray(email.to) ? email.to : [email.to];
    // Process attachments into a consistent ItemAttachment-compatible shape backed by local storage
    const attachmentsData = email.attachments
        ? await Promise.all(email.attachments.map(async (att) => {
            const stored = await persistEmailAttachment(att);
            return {
                filename: stored.filename,
                originalname: stored.originalname,
                mimetype: stored.mimetype,
                size: stored.size,
                checksum: stored.checksum,
                // No remote URL needed for newly stored attachments
                url: undefined,
                id: stored.id,
                contentId: stored.contentId,
            };
        }))
        : [];
    // Create raw content with Resend email ID
    const rawContent = JSON.stringify({
        resend_email_id: email.id,
        subject: email.subject,
        // Preserve both HTML and text where available
        html: email.html,
        text: email.text,
        // Backward-compatible body field (prefer HTML, fall back to text)
        body: email.html || email.text || '',
        from: fromEmail,
        to: toAddresses,
        created_at: email.created_at,
        // Store a compact view of attachments for debugging/back-compat (no remote URLs needed)
        attachments: attachmentsData.map((att) => ({
            filename: att.originalname,
            stored_filename: att.filename,
            mimetype: att.mimetype,
            size: att.size,
            content_id: att.contentId,
            id: att.id,
        })),
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
    }
    catch (error) {
        console.warn('[Email] Failed to upsert contact from Resend email:', {
            userId,
            error,
        });
    }
    return item;
}
// Resend inbound webhook
router.post('/inbound', async (req, res) => {
    try {
        /**
         * Resend (via Svix) wraps inbound events as:
         * {
         *   type: "email.received",
         *   created_at: "...",
         *   data: {
         *     from: string;
         *     to: string[];
         *     subject: string;
         *     text?: string;
         *     html?: string;
         *     attachments?: Array<...>;
         *     email_id?: string;
         *     message_id?: string;
         *     created_at?: string;
         *     headers?: Record<string, string>;
         *   }
         * }
         *
         * Older/alternative integrations might POST the email fields at the top level.
         * To support both, we unwrap `data` when present and fall back to the root.
         */
        const event = req.body;
        const email = event?.data ?? event;
        const { from, to, subject, text, html, attachments } = email ?? {};
        if (!from || !to || !subject) {
            return res.status(400).json({ error: 'Missing required email fields' });
        }
        // Normalize the "to" field - it can be a string or array
        const toAddressesRaw = Array.isArray(to) ? to : [to];
        const normalizedToAddresses = toAddressesRaw.map((addr) => normalizeEmailAddress(addr.includes('<') ? (addr.match(/<(.+)>/)?.[1] || addr) : addr));
        // Route per-user based on username@injest.io
        let user = null;
        for (const addr of normalizedToAddresses) {
            const resolved = await resolveInboundUserForAddress(addr);
            if (resolved) {
                user = resolved;
                break;
            }
        }
        if (!user) {
            console.log(`[Email] Inbound email not routed: no matching username@injest.io address. To: ${normalizedToAddresses.join(', ')}`);
            return res.status(404).json({ error: 'No matching inbox for recipient addresses' });
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
        // Store attachments by downloading them into local storage where possible.
        // This makes previews/downloads independent of Resend's URLs.
        const attachmentsData = attachments
            ? await Promise.all(attachments.map(async (att) => {
                const stored = await persistEmailAttachment(att);
                return {
                    filename: stored.filename,
                    originalname: stored.originalname,
                    mimetype: stored.mimetype,
                    size: stored.size,
                    checksum: stored.checksum,
                    // No remote URL needed for newly stored attachments
                    url: undefined,
                    // Keep the original attachment id when present for debugging/future use
                    id: stored.id,
                    contentId: stored.contentId,
                };
            }))
            : [];
        // Create item from email using unified structure
        // Also keep raw for backward compatibility
        // Include any email ID from webhook if available
        const emailId = email?.id ||
            email?.email_id ||
            event?.id ||
            event?.message_id ||
            null;
        const createdAt = email?.created_at || event?.created_at || new Date().toISOString();
        const headers = email?.headers || event?.headers;
        const messageId = email?.message_id || event?.message_id || null;
        const rawContent = JSON.stringify({
            resend_email_id: emailId,
            subject,
            // Preserve both HTML and text where available
            html,
            text,
            // Backward-compatible body field (prefer HTML, fall back to text)
            body: html || text || '',
            from: fromEmail,
            to,
            attachments: attachmentsData.map((att) => ({
                filename: att.originalname,
                stored_filename: att.filename,
                mimetype: att.mimetype,
                size: att.size,
                content_id: att.contentId,
                id: att.id,
            })),
            created_at: createdAt,
            headers,
            message_id: messageId,
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
        }
        catch (error) {
            console.warn('[Email] Failed to upsert contact from inbound webhook email:', {
                userId: user.id,
                error,
            });
        }
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
/**
 * Proxy endpoint for remote email attachments.
 *
 * Some inbound email providers (like Resend) expose attachment `download_url`s
 * that are not directly embeddable in the browser (e.g. require auth, have
 * strict CORS, or enforce `Content-Disposition: attachment`). To ensure that
 * image attachments render reliably in the UI, we proxy these requests through
 * our API. The browser only ever talks to our backend, and the backend is
 * responsible for fetching the remote attachment and streaming it back.
 *
 * Route: GET /api/email/attachments/:itemId/:attachmentId
 *
 * Security:
 * - Requires a valid JWT token (via Authorization header or `token` query param).
 * - Verifies that the user owns the item or has explicit access via ItemAccessModel.
 * - Only allows proxying for attachments that have a `url` field stored.
 */
router.get('/attachments/:itemId/:attachmentId', async (req, res) => {
    try {
        // Extract token from Authorization header or query string (for images)
        let token = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
        else if (req.query.token && typeof req.query.token === 'string') {
            token = req.query.token;
        }
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        // Verify token and load user
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await UserModel.findById(decoded.userId);
        if (!user || !user.verified) {
            return res.status(401).json({ error: 'User not found or not verified' });
        }
        req.user = {
            id: user.id,
            email: user.email,
        };
        const { itemId, attachmentId } = req.params;
        const item = await ItemModel.findById(itemId);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        const normalizedItem = normalizeItem(item);
        const hasAccess = normalizedItem.owner_id === req.user.id ||
            (await ItemAccessModel.userHasAccess(normalizedItem.id, req.user.id, req.user.email));
        if (!hasAccess) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (!normalizedItem.attachments ||
            !Array.isArray(normalizedItem.attachments) ||
            normalizedItem.attachments.length === 0) {
            return res.status(404).json({ error: 'Attachment not found on item' });
        }
        // Allow lookup by attachment.id / attachmentId / filename for robustness
        const attachment = normalizedItem.attachments.find((att) => att.id === attachmentId ||
            att.attachmentId === attachmentId ||
            att.filename === attachmentId) ?? null;
        if (!attachment) {
            return res.status(404).json({ error: 'Attachment not found' });
        }
        const downloadName = attachment.originalname || attachment.filename || 'attachment';
        const inline = req.query.inline === 'true' || req.query.inline === '1';
        // Prefer locally stored files when available (new behavior)
        if (attachment.filename && !attachment.url) {
            try {
                const fileStream = await fileStorageService.getFileStream(attachment.filename);
                const isImage = attachment.mimetype && attachment.mimetype.startsWith('image/');
                if (isImage && inline) {
                    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(downloadName)}"`);
                }
                else {
                    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadName)}"`);
                }
                res.setHeader('Content-Type', attachment.mimetype || 'application/octet-stream');
                fileStream.pipe(res);
                return;
            }
            catch (error) {
                console.error('[Email] Failed to stream local attachment, falling back to remote URL if available:', {
                    error,
                    itemId: normalizedItem.id,
                    attachmentId,
                });
            }
        }
        // Legacy/backup behavior: stream from remote URL if present
        if (attachment.url) {
            try {
                const remoteResponse = await fetch(attachment.url);
                if (!remoteResponse.ok || !remoteResponse.body) {
                    return res
                        .status(remoteResponse.status || 502)
                        .json({ error: 'Failed to fetch attachment from remote source' });
                }
                // In Node 18+, fetch() returns a web ReadableStream. Convert to Buffer.
                const arrayBuffer = await remoteResponse.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                // Forward relevant headers
                const contentType = remoteResponse.headers.get('content-type') || 'application/octet-stream';
                const isImage = contentType.startsWith('image/');
                res.setHeader('Content-Type', contentType);
                res.setHeader('Content-Length', buffer.length.toString());
                if (isImage && inline) {
                    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(downloadName)}"`);
                }
                else {
                    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadName)}"`);
                }
                // Send buffer to client
                res.send(buffer);
                return;
            }
            catch (remoteError) {
                console.error('[Email] Failed to fetch remote attachment URL:', {
                    error: remoteError,
                    url: attachment.url,
                    itemId: normalizedItem.id,
                    attachmentId,
                });
                // Fall through to Resend fallback
            }
        }
        /**
         * Final fallback: if we don't have a stored URL and the local file is missing,
         * try to fetch the attachment again from the email provider (Resend) using
         * the stored `resend_email_id` in the item's raw payload.
         *
         * This covers cases where:
         * - The attachment was originally stored via Resend but the local file
         *   has been GC'd / lost (e.g. ephemeral disk in production).
         * - We never successfully persisted the file locally but still have a
         *   stable attachment id we can ask Resend for.
         */
        let rawData = {};
        let remoteAttachmentId;
        try {
            if (item.raw) {
                try {
                    rawData = JSON.parse(item.raw);
                }
                catch {
                    rawData = {};
                }
            }
            const resendEmailId = rawData.resend_email_id;
            remoteAttachmentId = attachment.id || attachment.attachmentId || attachmentId;
            if (resendEmailId && remoteAttachmentId) {
                const blob = await emailService.getEmailAttachment(resendEmailId, remoteAttachmentId);
                const buffer = Buffer.from(await blob.arrayBuffer());
                const contentType = blob.type || attachment.mimetype || 'application/octet-stream';
                const isImage = contentType.startsWith('image/');
                res.setHeader('Content-Type', contentType);
                if (isImage && inline) {
                    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(downloadName)}"`);
                }
                else {
                    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadName)}"`);
                }
                res.send(buffer);
                return;
            }
        }
        catch (fallbackError) {
            // Extract a concise error message
            const errorMessage = fallbackError?.message || String(fallbackError);
            const conciseError = errorMessage.length > 300
                ? `${errorMessage.substring(0, 300)}...`
                : errorMessage;
            console.error('[Email] Failed Resend fallback for attachment:', {
                error: conciseError,
                itemId: normalizedItem.id,
                attachmentId,
                hasResendEmailId: !!rawData.resend_email_id,
                hasRemoteAttachmentId: !!remoteAttachmentId,
            });
        }
        // If we reach here, we have no way to retrieve the attachment contents
        return res.status(404).json({ error: 'Attachment URL not available' });
    }
    catch (error) {
        console.error('[Email] Error proxying attachment:', error);
        res.status(500).json({ error: 'Failed to proxy attachment' });
    }
});
// Simple helper to decide if a sender should be treated as a system/non-user sender
function isSystemSender(email) {
    const lower = email.trim().toLowerCase();
    // Filter obvious Resend system domains
    const systemDomains = ['resend.dev', 'resend.com', 'resend.net', 'email.resend.com'];
    const domain = lower.split('@')[1] || '';
    if (systemDomains.includes(domain)) {
        return true;
    }
    // Filter our own system-level addresses like noreply@injest.io
    if (domain === (process.env.INBOUND_EMAIL_DOMAIN || 'injest.io').toLowerCase()) {
        const local = lower.split('@')[0] || '';
        if (local === 'noreply') {
            return true;
        }
    }
    return false;
}
// Get list of received emails for the authenticated user
router.get('/received', authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
        // Inbox should be driven from our own stored email items, not Resend's outbound/system traffic.
        const allDbItems = await ItemModel.findByOwnerAndType(req.user.id, 'email', limit || 100, 0);
        // Convert DB items to Resend-like format and filter out system/outbound emails
        const allEmailItems = allDbItems
            .map((item) => {
            let rawData = {};
            try {
                rawData = item.raw ? JSON.parse(item.raw) : {};
            }
            catch {
                // If raw is not JSON, use defaults
            }
            // Extract email address from source field
            const sourceMatch = item.source?.match(/email:(.+)/);
            const fromEmail = sourceMatch ? sourceMatch[1] : '';
            const attachments = (item.attachments || []).map((att) => ({
                id: att.id || att.filename,
                filename: att.originalname || att.filename,
                size: att.size ?? 0,
                content_type: att.mimetype || 'application/octet-stream',
                download_url: att.url,
                // Expose preserved contentId back as content_id for Resend-like API
                content_id: att.contentId,
            }));
            return {
                id: rawData.resend_email_id || item.id,
                to: rawData.to || [],
                from: fromEmail,
                created_at: rawData.created_at || item.created_at,
                subject: item.title || rawData.subject || '',
                html: item.description || rawData.body || '',
                text: rawData.body || item.description || '',
                attachments,
                headers: rawData.headers,
                message_id: rawData.message_id,
            };
        })
            // Exclude obvious system/generic senders and outbound-only records
            .filter((email) => {
            if (!email.from)
                return false;
            if (isSystemSender(email.from))
                return false;
            // Exclude items that we know are outbound send workflow records
            if (email.headers?.source === 'send_workflow:outbound')
                return false;
            return true;
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
            // Verify ownership or shared access
            const hasAccess = item.owner_id === req.user.id ||
                (await ItemAccessModel.userHasAccess(item.id, req.user.id, req.user.email));
            if (!hasAccess) {
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
            // Normalize attachments to Resend-like format so the frontend can render them consistently
            const attachments = (item.attachments || []).map((att) => ({
                id: att.id || att.filename,
                filename: att.originalname || att.filename,
                size: att.size ?? 0,
                content_type: att.mimetype || 'application/octet-stream',
                download_url: att.url,
                // Expose preserved contentId back as content_id for Resend-like API
                content_id: att.contentId,
            }));
            const emailResponse = {
                id: rawData.resend_email_id || item.id,
                to: rawData.to || [],
                from: fromEmail,
                created_at: rawData.created_at || item.created_at,
                subject: item.title || rawData.subject || '',
                html: item.description || rawData.body || '',
                text: rawData.body || item.description || '',
                attachments,
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
    }
    catch (error) {
        console.error('Error generating email summary:', error);
        res.status(500).json({ error: 'Failed to generate email summary' });
    }
});
export default router;
//# sourceMappingURL=email.js.map