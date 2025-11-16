import express from 'express';
import { ItemModel } from '../models/Item.js';
import { authMiddleware } from '../middleware/auth.js';
import { indexingService } from '../services/indexing.js';
import { linkMetadataService } from '../services/linkMetadata.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileStorageService } from '../services/storage.js';
import { fileParserService } from '../services/fileParser.js';
import { openAIService } from '../services/openai.js';
import { bookmarkParserService } from '../services/bookmarkParser.js';
import { ocrService } from '../services/ocr.js';
import { UserModel } from '../models/User.js';
import pool from '../config/database.js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/auth.js';
import { computeFileChecksum } from '../utils/checksum.js';
import { decodeOriginalFilename, normalizeItem, sanitizeOriginalFilename } from '../utils/itemNormalization.js';
import { itemStreamService } from '../services/itemStream.js';
import { emailService } from '../services/email.js';
import { ItemAccessModel } from '../models/ItemAccess.js';
import { ContactModel } from '../models/Contact.js';
import { contactExtractor } from '../services/contactExtractor.js';
import { contactStreamService } from '../services/contactStream.js';
import { coerceSubscriptionTier, getMaxIndexedItems, getPlan, } from '../utils/subscriptionPlans.js';
import { searchService } from '../services/search.js';
import { CollectionItemModel } from '../models/CollectionItem.js';
const router = express.Router();
const TIER_UPGRADE_PATH = {
    free: 'pro',
    pro: null,
    pro_annual: null,
};
const formatCurrency = (cents) => `$${(cents / 100).toFixed(2)}`;
const formatPlanPriceWithInterval = (plan) => {
    const suffix = plan.billingInterval === 'year' ? '/year' : '/month';
    return `${formatCurrency(plan.priceCents)}${suffix}`;
};
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.toLowerCase());
const normalizeBaseUrl = (value) => {
    if (!value) {
        return null;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return null;
    }
    const sanitized = trimmed.replace(/\/+$/, '');
    if (/^https?:\/\//i.test(sanitized)) {
        return sanitized;
    }
    return `https://${sanitized}`;
};
const resolveFrontendBaseUrl = () => {
    const candidates = [
        process.env.NEXT_PUBLIC_APP_URL,
        process.env.FRONTEND_URL,
        process.env.APP_BASE_URL,
        process.env.APP_URL,
        process.env.WEB_APP_URL,
        process.env.VERCEL_PROJECT_PRODUCTION_URL,
        process.env.VERCEL_URL,
    ];
    for (const candidate of candidates) {
        const normalized = normalizeBaseUrl(candidate);
        if (normalized) {
            return normalized;
        }
    }
    if (process.env.NODE_ENV !== 'production') {
        return 'http://localhost:3000';
    }
    return null;
};
const extractContactCandidatesFromText = (text) => {
    if (!text || text.trim().length === 0) {
        return [];
    }
    try {
        return contactExtractor.extract(text);
    }
    catch (error) {
        console.error('[Contacts] Failed to extract contact candidates from text:', error);
        return [];
    }
};
async function persistContactCandidatesForItem(client, ownerId, itemId, candidates, context = {}) {
    const validCandidates = candidates.filter((candidate) => candidate.email);
    if (!validCandidates.length) {
        return [];
    }
    const metadataBase = {
        source: context.source ?? 'ocr',
        itemId,
    };
    if (context.filename) {
        metadataBase.filename = context.filename;
    }
    if (context.textSample) {
        metadataBase.textSample = context.textSample;
    }
    const contacts = await ContactModel.upsertMany(validCandidates.map((candidate) => ({
        ownerId,
        name: candidate.name ?? undefined,
        email: candidate.email ?? undefined,
        sourceItemId: itemId,
        metadata: {
            ...(candidate.metadata ?? {}),
            ...metadataBase,
        },
    })), client);
    return contacts;
}
// Download file or serve inline (for images)
// Note: This route is defined before authMiddleware to allow token in query string for images
router.get('/:id/files/:filename', async (req, res) => {
    try {
        // Check for token in Authorization header or query string (for images)
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
        // Verify token and get user
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await UserModel.findById(decoded.userId);
        if (!user || !user.verified) {
            return res.status(401).json({ error: 'User not found or not verified' });
        }
        req.user = {
            id: user.id,
            email: user.email,
        };
        const item = await ItemModel.findById(req.params.id);
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
            return res.status(400).json({ error: 'Item does not have attachments' });
        }
        // Find file info from attachments array
        const fileInfo = normalizedItem.attachments.find((f) => f.filename === req.params.filename);
        if (!fileInfo) {
            return res.status(404).json({ error: 'File not found in item' });
        }
        // Get file stream
        try {
            const fileStream = await fileStorageService.getFileStream(fileInfo.filename);
            // Check if this is an image and should be served inline
            const isImage = fileInfo.mimetype && fileInfo.mimetype.startsWith('image/');
            const inline = req.query.inline === 'true' || req.query.inline === '1';
            const downloadName = sanitizeOriginalFilename(fileInfo.originalname ?? fileInfo.filename);
            // Set appropriate headers
            if (isImage && inline) {
                // Serve image inline for display
                res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(downloadName)}"`);
            }
            else {
                // Force download for non-images or when inline is not requested
                res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadName)}"`);
            }
            res.setHeader('Content-Type', fileInfo.mimetype || 'application/octet-stream');
            // Pipe file to response
            fileStream.pipe(res);
        }
        catch (fileError) {
            if (fileError.message === 'File not found') {
                return res.status(404).json({ error: 'File not found on server' });
            }
            throw fileError;
        }
    }
    catch (error) {
        console.error('Error downloading file:', error);
        res.status(500).json({ error: 'Failed to download file' });
    }
});
router.get('/stream', async (req, res) => {
    try {
        let token = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
        else if (req.query.token && typeof req.query.token === 'string') {
            token = req.query.token;
        }
        if (!token) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        }
        catch {
            res.status(401).json({ error: 'Invalid token' });
            return;
        }
        const user = await UserModel.findById(decoded.userId);
        if (!user || !user.verified) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        if (req.socket && typeof req.socket.setKeepAlive === 'function') {
            req.socket.setKeepAlive(true);
        }
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();
        const client = itemStreamService.addClient(user.id, res);
        const cleanup = () => {
            itemStreamService.removeClient(user.id, client);
        };
        req.on('close', cleanup);
        req.on('end', cleanup);
    }
    catch (error) {
        console.error('[SSE] Failed to establish item stream:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to establish stream' });
        }
    }
});
router.use(authMiddleware);
// Configure multer for file uploads (Multer 2.x compatible)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = process.env.UPLOAD_DIR || './uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Generate a unique filename using UUID to ensure uniqueness
        // Preserve the original file extension for proper file type detection
        const decodedOriginalName = decodeOriginalFilename(file.originalname);
        const sanitizedOriginalName = sanitizeOriginalFilename(decodedOriginalName);
        if (sanitizedOriginalName !== file.originalname) {
            file.originalname = sanitizedOriginalName;
        }
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext);
        // Use crypto.randomUUID() if available (Node 14.17+), otherwise fall back to randomBytes
        let uniqueId;
        try {
            uniqueId = crypto.randomUUID();
        }
        catch {
            // Fallback for older Node versions
            uniqueId = crypto.randomBytes(16).toString('hex');
        }
        // Create unique filename: {uuid}-{sanitized-original-name}{ext}
        // Sanitize original name to remove special characters that might cause issues
        const sanitizedName = sanitizeOriginalFilename(baseName).replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50);
        const uniqueFilename = `${uniqueId}-${sanitizedName}${ext}`;
        cb(null, uniqueFilename);
    },
});
export const upload = multer({
    storage,
    limits: {
        fileSize: 25 * 1024 * 1024, // 25MB
    },
});
/**
 * Helper function to check if a user can create more items
 * Returns null if allowed, or an error response object if blocked
 */
async function checkItemCreationLimit(userId) {
    // Get user to check subscription tier
    const user = await UserModel.findById(userId);
    const subscriptionTier = user ? coerceSubscriptionTier(user.subscription_tier) : 'free';
    if (!user) {
        return { status: 404, error: 'User not found', message: 'User not found' };
    }
    const tier = coerceSubscriptionTier(user.subscription_tier);
    const plan = getPlan(tier);
    const limit = getMaxIndexedItems(tier);
    // Check current indexed item count
    const result = await pool.query('SELECT COUNT(*) as total FROM items WHERE owner_id = $1 AND embedding_id IS NOT NULL AND deleted_at IS NULL', [userId]);
    const itemCount = parseInt(result.rows[0].total, 10);
    if (itemCount >= limit) {
        const upgradeTier = TIER_UPGRADE_PATH[tier];
        const upgradePlan = upgradeTier ? getPlan(upgradeTier) : null;
        const upgradeMessage = upgradePlan
            ? ` Upgrade to the ${upgradePlan.name} plan (${formatPlanPriceWithInterval(upgradePlan)}) for ${typeof upgradePlan.maxIndexedItems === 'number'
                ? `up to ${upgradePlan.maxIndexedItems.toLocaleString()} items`
                : 'unlimited items'}.`
            : '';
        return {
            status: 403,
            error: 'Item limit exceeded',
            message: `You have reached the limit of ${limit.toLocaleString()} indexed items on the ${plan.name} plan.${upgradeMessage}`,
            itemCount,
            limit,
            subscriptionTier: tier,
        };
    }
    return null; // Allowed
}
/**
 * Helper function to get item count and limit status
 */
async function getItemLimitStatus(userId) {
    // Get user to check subscription tier
    const user = await UserModel.findById(userId);
    if (!user) {
        return { itemCount: 0, isAtLimit: false, isApproachingLimit: false, limit: 1000, subscriptionTier: 'free', planName: getPlan('free').name };
    }
    const tier = coerceSubscriptionTier(user.subscription_tier);
    const plan = getPlan(tier);
    const limit = getMaxIndexedItems(tier);
    // Check current indexed item count (always query the actual count)
    const result = await pool.query('SELECT COUNT(*) as total FROM items WHERE owner_id = $1 AND embedding_id IS NOT NULL AND deleted_at IS NULL', [userId]);
    const itemCount = parseInt(result.rows[0].total, 10);
    const isAtLimit = itemCount >= limit;
    const isApproachingLimit = !isAtLimit && itemCount >= Math.max(0, Math.floor(limit * 0.9));
    return {
        itemCount,
        isAtLimit,
        isApproachingLimit,
        limit,
        subscriptionTier: tier,
        planName: plan.name,
    };
}
function buildTagList(input) {
    if (!input) {
        return undefined;
    }
    if (Array.isArray(input)) {
        return input;
    }
    return input
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
}
async function deleteFileSafe(filename, logger) {
    try {
        await fileStorageService.deleteFile(filename);
    }
    catch (cleanupError) {
        const msg = `[UPLOAD] Failed to delete file ${filename} during cleanup: ${cleanupError?.message ?? cleanupError}`;
        if (logger) {
            logger(msg);
        }
        else {
            console.warn(msg);
        }
    }
}
async function processSingleFile(file, userId, options = {}) {
    const { sharedNotes, sharedTags, providedTitle, providedDescription, providedUrl, loggerPrefix, } = options;
    const stagePrefix = loggerPrefix ?? `[PROCESS][${file.originalname}]`;
    const log = (message) => console.log(`${stagePrefix} ${message}`);
    const warn = (message) => console.warn(`${stagePrefix} ${message}`);
    const logError = (message, error) => {
        if (error) {
            console.error(`${stagePrefix} ${message}`, error);
        }
        else {
            console.error(`${stagePrefix} ${message}`);
        }
    };
    const client = await pool.connect();
    let contactsToBroadcast = [];
    try {
        await client.query('BEGIN');
        const isImageFile = ocrService.isImage(file.mimetype, file.originalname);
        log('Stage 1/4: Extracting text content (OCR/Vision)');
        const parsedContent = await fileParserService.parseFile(file.filename, file.mimetype);
        const extractionSource = parsedContent.metadata?.source || (isImageFile ? 'ocr' : 'text');
        const contactCandidates = extractContactCandidatesFromText(parsedContent.text);
        const contactTextSample = parsedContent.text ? parsedContent.text.substring(0, 280) : undefined;
        log(`Stage 1/4 complete (${extractionSource.toUpperCase()})`);
        log('Stage 2/4: Generating metadata (title, description)');
        let finalTitle = providedTitle || undefined;
        let finalDescription = providedDescription || undefined;
        const hasExtractedText = parsedContent.text && parsedContent.text.trim().length > 0;
        if ((!finalTitle || !finalDescription) && hasExtractedText) {
            if (isImageFile) {
                const isVisionSource = parsedContent.metadata?.source === 'vision';
                if (isVisionSource) {
                    if (!finalTitle && parsedContent.title) {
                        finalTitle = parsedContent.title;
                    }
                    if (!finalDescription && parsedContent.text) {
                        finalDescription = parsedContent.text;
                    }
                    if (!finalTitle) {
                        finalTitle = path.basename(file.originalname, path.extname(file.originalname));
                    }
                }
                else {
                    if (!finalDescription && parsedContent.text) {
                        finalDescription = parsedContent.text;
                    }
                    if (!finalTitle && parsedContent.text) {
                        try {
                            const generated = await openAIService.generateTitleAndDescription(parsedContent.text, file.originalname);
                            finalTitle = generated.title;
                        }
                        catch (titleError) {
                            logError('Error generating title from OCR text', titleError);
                            finalTitle = path.basename(file.originalname, path.extname(file.originalname));
                        }
                    }
                }
            }
            else if (!finalTitle || !finalDescription) {
                try {
                    const generated = await openAIService.generateTitleAndDescription(parsedContent.text, file.originalname);
                    if (!finalTitle) {
                        finalTitle = generated.title;
                    }
                    if (!finalDescription) {
                        finalDescription = generated.description;
                    }
                }
                catch (titleError) {
                    logError('Error generating title/description from file content', titleError);
                    if (!finalTitle) {
                        finalTitle = path.basename(file.originalname, path.extname(file.originalname));
                    }
                    if (!finalDescription && parsedContent.text) {
                        finalDescription = parsedContent.text.substring(0, 500) +
                            (parsedContent.text.length > 500 ? '...' : '');
                    }
                }
            }
        }
        if (!finalTitle) {
            finalTitle = path.basename(file.originalname, path.extname(file.originalname));
        }
        log(`Stage 2/4 complete (title: "${finalTitle}"${finalDescription ? ', description generated' : ''})`);
        let parsedTags = sharedTags;
        if (!parsedTags) {
            try {
                const contentForTagging = [];
                if (finalTitle)
                    contentForTagging.push(finalTitle);
                if (finalDescription)
                    contentForTagging.push(finalDescription);
                if (sharedNotes)
                    contentForTagging.push(sharedNotes);
                if (hasExtractedText && parsedContent.text) {
                    contentForTagging.push(parsedContent.text.substring(0, 500));
                }
                if (contentForTagging.length > 0) {
                    const combinedContent = contentForTagging.join(' ');
                    parsedTags = await openAIService.generateTags(combinedContent);
                }
            }
            catch (error) {
                warn(`Error auto-generating tags: ${error?.message ?? error}`);
            }
        }
        const attachments = [{
                filename: file.filename,
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                checksum: file.checksum,
            }];
        log('Stage 3/4: Persisting item record');
        const item = await ItemModel.create({
            owner_id: userId,
            title: finalTitle || undefined,
            description: finalDescription || undefined,
            url: providedUrl || undefined,
            attachments: attachments,
            notes: sharedNotes || undefined,
            tags: parsedTags,
            source: 'web',
        }, client);
        if (contactCandidates.length > 0) {
            contactsToBroadcast = await persistContactCandidatesForItem(client, userId, item.id, contactCandidates, {
                filename: file.originalname,
                source: extractionSource,
                textSample: contactTextSample,
            });
        }
        await client.query('COMMIT');
        log(`Stage 3/4 complete (item ${item.id})`);
        if (contactsToBroadcast.length > 0) {
            contactStreamService.broadcastContacts(contactsToBroadcast);
            await Promise.all(contactsToBroadcast.map(async (contact) => {
                try {
                    await indexingService.indexContact(contact);
                }
                catch (error) {
                    console.warn('[Contacts] Failed to index contact extracted from item:', {
                        contactId: contact.id,
                        error,
                    });
                }
            }));
        }
        log('Stage 4/4: Generating embeddings and indexing');
        try {
            const indexed = await indexingService.indexItem(item);
            if (indexed) {
                log(`Stage 4/4 complete (indexed item ${item.id})`);
            }
            else {
                warn(`Stage 4/4 skipped (item ${item.id} was not found during indexing)`);
            }
        }
        catch (indexError) {
            logError(`Stage 4/4 failed for item ${item.id}`, indexError);
            throw indexError;
        }
        return { item: normalizeItem(item) };
    }
    catch (error) {
        await client.query('ROLLBACK').catch((rollbackError) => {
            logError('Failed to rollback transaction after error', rollbackError);
        });
        logError(`Error processing file ${file.originalname}`, error);
        const message = error?.code === '23505' && error?.duplicate_checksum
            ? 'Duplicate file upload detected for this user'
            : error?.message || 'Failed to process file';
        await deleteFileSafe(file.filename, warn);
        return {
            item: null,
            error: message
        };
    }
    finally {
        client.release();
    }
}
function scheduleUploadProcessing(job, loggerPrefix = '[UPLOAD]') {
    setImmediate(() => {
        void processQueuedUpload(job, loggerPrefix).catch((error) => {
            console.error(`${loggerPrefix} Failed queued upload for user ${job.userId}:`, error);
        });
    });
}
async function processQueuedUpload(job, loggerPrefix = '[UPLOAD]') {
    const { files, userId, notes, tags, title, description, url } = job;
    if (!files.length) {
        return;
    }
    const sharedTags = buildTagList(tags);
    console.log(`${loggerPrefix} Processing ${files.length} queued file(s) for user ${userId}`);
    for (let index = 0; index < files.length; index++) {
        const file = files[index];
        const filePrefix = `${loggerPrefix} [${index + 1}/${files.length}] ${file.originalname ?? file.filename}`;
        console.log(`${filePrefix} Starting background processing`);
        const limitCheck = await checkItemCreationLimit(userId);
        if (limitCheck) {
            console.warn(`${filePrefix} Skipping due to item limit: ${limitCheck.message}`);
            await deleteFileSafe(file.filename);
            continue;
        }
        try {
            const result = await processSingleFile(file, userId, {
                sharedNotes: notes,
                sharedTags,
                providedTitle: title,
                providedDescription: description,
                providedUrl: url,
                loggerPrefix: filePrefix,
            });
            if (result.item) {
                console.log(`${filePrefix} Processing complete (item ${result.item.id})`);
            }
            else {
                console.warn(`${filePrefix} Processing failed: ${result.error ?? 'Unknown error'}`);
            }
        }
        catch (error) {
            console.error(`${filePrefix} Unhandled error during processing`, error);
            await deleteFileSafe(file.filename);
        }
    }
    console.log(`${loggerPrefix} Completed queued processing for user ${userId}`);
}
// Create item (unified structure)
export async function handleCreateItem(req, res) {
    try {
        const { title, description, url, notes, tags } = req.body;
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Validate user ID exists (defensive check)
        if (!req.user.id || typeof req.user.id !== 'string') {
            console.error('Invalid user ID:', req.user.id);
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        // Check item creation limit (1,000 items for free tier, unlimited for Pro)
        const limitCheck = await checkItemCreationLimit(req.user.id);
        if (limitCheck) {
            return res.status(limitCheck.status).json({
                error: limitCheck.error,
                message: limitCheck.message,
            });
        }
        // Validate that at least one field is provided
        if (!title && !description && !url && (!req.files || req.files.length === 0)) {
            return res.status(400).json({
                error: 'Invalid item data',
                details: 'Must provide at least title, description, URL, or attachments'
            });
        }
        const rawFiles = req.files && Array.isArray(req.files) ? req.files : [];
        const files = await Promise.all(rawFiles.map(async (file) => {
            const checksum = await computeFileChecksum(fileStorageService.getFilePath(file.filename));
            return Object.assign(file, { checksum });
        }));
        const unsupportedMedia = files.filter((file) => {
            const mimetype = file.mimetype?.toLowerCase() ?? '';
            return mimetype.startsWith('audio/') || mimetype.startsWith('video/');
        });
        if (unsupportedMedia.length > 0) {
            await Promise.all(files.map(async (file) => {
                try {
                    await fileStorageService.deleteFile(file.filename);
                }
                catch (cleanupError) {
                    console.warn(`Failed to delete unsupported upload ${file.filename}:`, cleanupError);
                }
            }));
            return res.status(400).json({
                error: 'Unsupported file type',
                message: 'Audio and video uploads are not supported at this time.',
            });
        }
        if (files.length > 0) {
            const acceptedFiles = [];
            const duplicateFiles = [];
            for (const file of files) {
                const existingItem = await ItemModel.findByAttachmentChecksum(req.user.id, file.checksum);
                if (existingItem) {
                    duplicateFiles.push({
                        checksum: file.checksum,
                        filename: file.originalname,
                        itemId: existingItem.id,
                        title: existingItem.title,
                    });
                    try {
                        await fileStorageService.deleteFile(file.filename);
                    }
                    catch (cleanupError) {
                        console.warn(`Failed to delete duplicate upload ${file.filename}:`, cleanupError);
                    }
                }
                else {
                    acceptedFiles.push(file);
                }
            }
            const duplicateSummaries = duplicateFiles.map((duplicate) => ({
                filename: duplicate.filename,
                itemId: duplicate.itemId,
                title: duplicate.title,
            }));
            if (acceptedFiles.length === 0) {
                const acknowledgement = {
                    queued: true,
                    uploadedCount: 0,
                    duplicateCount: duplicateFiles.length,
                    message: duplicateFiles.length > 0
                        ? 'All files were duplicates and have been skipped. No new processing was started.'
                        : 'No files were queued for processing.',
                    files: [],
                    duplicates: duplicateSummaries.length > 0 ? duplicateSummaries : undefined,
                };
                return res.status(200).json(acknowledgement);
            }
            scheduleUploadProcessing({
                files: acceptedFiles,
                userId: req.user.id,
                title,
                description,
                url,
                notes,
                tags,
            });
            const acknowledgement = {
                queued: true,
                uploadedCount: acceptedFiles.length,
                duplicateCount: duplicateFiles.length,
                message: duplicateFiles.length > 0
                    ? `Queued ${acceptedFiles.length} file(s). Skipped ${duplicateFiles.length} duplicate(s). Processing may take a few minutes while we finish enrichment.`
                    : `Queued ${acceptedFiles.length} file(s) for enrichment. Processing may take a few minutes.`,
                files: acceptedFiles.map((file) => ({
                    filename: file.originalname,
                    storedFilename: file.filename,
                    mimetype: file.mimetype,
                    size: file.size,
                })),
                duplicates: duplicateSummaries.length > 0 ? duplicateSummaries : undefined,
            };
            return res.status(202).json(acknowledgement);
        }
        let attachments = [];
        if (files.length > 0) {
            attachments = files.map((file) => ({
                filename: file.filename,
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                checksum: file.checksum,
            }));
        }
        const primaryFile = files.length > 0 ? files[0] : undefined;
        let parsedContentForContacts = null;
        let contactCandidates = [];
        let contactExtractionSource;
        let contactTextSample;
        let contactFilename;
        const ensureContactExtraction = async () => {
            if (!primaryFile || parsedContentForContacts) {
                return;
            }
            try {
                const parsed = await fileParserService.parseFile(primaryFile.filename, primaryFile.mimetype);
                parsedContentForContacts = parsed;
                contactCandidates = extractContactCandidatesFromText(parsed.text);
                contactExtractionSource =
                    parsed.metadata?.source ||
                        (ocrService.isImage(primaryFile.mimetype, primaryFile.originalname) ? 'ocr' : 'text');
                contactTextSample = parsed.text ? parsed.text.substring(0, 280) : undefined;
                contactFilename = primaryFile.originalname;
            }
            catch (error) {
                console.error('Error extracting contacts from primary file:', error);
            }
        };
        // Auto-fill title and description from file content if missing
        let finalTitle = title;
        let finalDescription = description;
        let linkMetadata = null;
        // Auto-fill title and description from URL metadata if URL is provided without title/description
        if (url && !finalTitle && !finalDescription) {
            try {
                const metadata = await linkMetadataService.fetchMetadata(url);
                linkMetadata = metadata;
                // Use metadata title and description if available
                if (metadata.title) {
                    finalTitle = metadata.title;
                }
                if (metadata.description) {
                    finalDescription = metadata.description;
                }
            }
            catch (error) {
                // Log error but don't fail the request - metadata fetching is optional
                console.error('Error fetching link metadata:', error);
            }
        }
        if ((!finalTitle || !finalDescription) && primaryFile) {
            try {
                const isImageFile = ocrService.isImage(primaryFile.mimetype, primaryFile.originalname);
                // Parse the file to extract content (for images, this will use OCR or Vision API)
                const parsedContent = await fileParserService.parseFile(primaryFile.filename, primaryFile.mimetype);
                if (!parsedContentForContacts) {
                    parsedContentForContacts = parsedContent;
                    contactCandidates = extractContactCandidatesFromText(parsedContent.text);
                    contactExtractionSource =
                        parsedContent.metadata?.source || (isImageFile ? 'ocr' : 'text');
                    contactTextSample = parsedContent.text ? parsedContent.text.substring(0, 280) : undefined;
                    contactFilename = primaryFile.originalname;
                }
                if (parsedContent.text && parsedContent.text.trim().length > 0) {
                    if (isImageFile) {
                        // Check if description came from Vision API (when OCR found no text)
                        const isVisionSource = parsedContent.metadata?.source === 'vision';
                        if (isVisionSource) {
                            // If Vision API was used, use the title and description from parsed content
                            // (fileParser already called Vision API and stored both)
                            if (!finalTitle && parsedContent.title) {
                                finalTitle = parsedContent.title;
                            }
                            if (!finalDescription) {
                                finalDescription = parsedContent.text;
                            }
                            // Fallback if title wasn't set (shouldn't happen, but defensive)
                            if (!finalTitle) {
                                finalTitle = path.basename(primaryFile.originalname, path.extname(primaryFile.originalname));
                            }
                        }
                        else {
                            // OCR found text - use OCR text as description, then generate title from OCR text
                            // Put OCR text into description if no description was provided
                            if (!finalDescription) {
                                finalDescription = parsedContent.text;
                            }
                            // Generate a concise title from the OCR text (which is now in the description)
                            // Always try to generate title from OCR text for images if no title was provided
                            if (!finalTitle) {
                                try {
                                    const generated = await openAIService.generateTitleAndDescription(parsedContent.text, primaryFile.originalname);
                                    finalTitle = generated.title;
                                }
                                catch (titleError) {
                                    // If title generation fails, fallback to filename
                                    console.error('Error generating title from OCR text:', titleError);
                                    finalTitle = path.basename(primaryFile.originalname, path.extname(primaryFile.originalname));
                                }
                            }
                        }
                    }
                    else {
                        // For non-image files: generate both title and description from content
                        const generated = await openAIService.generateTitleAndDescription(parsedContent.text, primaryFile.originalname);
                        // Only use generated values if the corresponding field is missing
                        if (!finalTitle) {
                            finalTitle = generated.title;
                        }
                        if (!finalDescription) {
                            finalDescription = generated.description;
                        }
                    }
                }
            }
            catch (error) {
                // Log error but don't fail the request - fallback to filename if title is missing
                console.error('Error auto-filling title/description from file:', error);
                if (!finalTitle && primaryFile) {
                    finalTitle = path.basename(primaryFile.originalname, path.extname(primaryFile.originalname));
                }
            }
        }
        // Auto-generate tags using ChatGPT if not provided
        let parsedTags = undefined;
        if (tags) {
            // If tags are manually provided, use them
            if (typeof tags === 'string') {
                parsedTags = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
            }
            else if (Array.isArray(tags)) {
                parsedTags = tags;
            }
        }
        else {
            // Auto-generate tags from content
            try {
                // Collect all available content for tag generation
                const contentForTagging = [];
                if (finalTitle)
                    contentForTagging.push(finalTitle);
                if (finalDescription)
                    contentForTagging.push(finalDescription);
                if (notes)
                    contentForTagging.push(notes);
                if (linkMetadata?.title)
                    contentForTagging.push(linkMetadata.title);
                if (linkMetadata?.description)
                    contentForTagging.push(linkMetadata.description);
                // If we have files, try to extract text content
                if (primaryFile) {
                    try {
                        if (!parsedContentForContacts) {
                            await ensureContactExtraction();
                        }
                        let parsedContent = parsedContentForContacts;
                        if (!parsedContent) {
                            parsedContent = await fileParserService.parseFile(primaryFile.filename, primaryFile.mimetype);
                            parsedContentForContacts = parsedContent;
                            contactCandidates = extractContactCandidatesFromText(parsedContent.text);
                            contactExtractionSource =
                                parsedContent.metadata?.source ||
                                    (ocrService.isImage(primaryFile.mimetype, primaryFile.originalname) ? 'ocr' : 'text');
                            contactTextSample = parsedContent.text ? parsedContent.text.substring(0, 280) : undefined;
                            contactFilename = primaryFile.originalname;
                        }
                        if (parsedContent.text && parsedContent.text.trim().length > 0) {
                            // Add first 500 chars of file content for tagging
                            contentForTagging.push(parsedContent.text.substring(0, 500));
                        }
                    }
                    catch (error) {
                        // Ignore file parsing errors for tagging
                        console.error('Error parsing file for tagging:', error);
                    }
                }
                // Generate tags if we have content
                if (contentForTagging.length > 0) {
                    const combinedContent = contentForTagging.join(' ');
                    parsedTags = await openAIService.generateTags(combinedContent);
                }
            }
            catch (error) {
                // Log error but don't fail the request - tags are optional
                console.error('Error auto-generating tags:', error);
            }
        }
        let item = null;
        let contactsToBroadcast = [];
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await ensureContactExtraction();
            item = await ItemModel.create({
                owner_id: req.user.id,
                title: finalTitle || undefined,
                description: finalDescription || undefined,
                url: url || undefined,
                attachments: attachments.length > 0 ? attachments : undefined,
                notes: notes || undefined,
                tags: parsedTags,
                source: 'web',
                link_metadata: linkMetadata || undefined,
            }, client);
            if (item && contactCandidates.length > 0) {
                contactsToBroadcast = await persistContactCandidatesForItem(client, req.user.id, item.id, contactCandidates, {
                    filename: contactFilename,
                    source: contactExtractionSource,
                    textSample: contactTextSample,
                });
            }
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK').catch((rollbackError) => {
                console.error('Failed to rollback transaction after error:', rollbackError);
            });
            if (error?.code === '23505' && error?.duplicate_checksum) {
                await Promise.all(files.map(async (file) => {
                    try {
                        await fileStorageService.deleteFile(file.filename);
                    }
                    catch (cleanupError) {
                        console.warn(`Failed to delete duplicate upload ${file.filename}:`, cleanupError);
                    }
                }));
                return res.status(409).json({
                    error: 'Duplicate file upload detected',
                    duplicates: attachments
                        .filter((attachment) => attachment.checksum === error.duplicate_checksum)
                        .map((attachment) => ({
                        filename: attachment.originalname || attachment.filename,
                        checksum: attachment.checksum,
                    })),
                });
            }
            throw error;
        }
        finally {
            client.release();
        }
        if (!item) {
            return;
        }
        if (contactsToBroadcast.length > 0) {
            contactStreamService.broadcastContacts(contactsToBroadcast);
            await Promise.all(contactsToBroadcast.map(async (contact) => {
                try {
                    await indexingService.indexContact(contact);
                }
                catch (error) {
                    console.warn('[Contacts] Failed to index contact extracted from item:', {
                        contactId: contact.id,
                        error,
                    });
                }
            }));
        }
        // Trigger indexing in background (don't await - let it run async)
        indexingService.indexItem(item).catch((indexError) => {
            console.error(`Background indexing failed for item ${item.id}:`, indexError);
            // Don't fail the request if indexing fails
        });
        res.status(201).json(normalizeItem(item));
    }
    catch (error) {
        // Handle multer errors
        if (error instanceof multer.MulterError) {
            console.error('Multer error:', error);
            return res.status(400).json({ error: `File upload error: ${error.message}` });
        }
        // Handle PostgreSQL constraint violations
        if (error?.code === '23505') { // Unique violation
            console.error('Database unique constraint violation:', error);
            return res.status(400).json({
                error: 'Item already exists',
                details: process.env.NODE_ENV === 'development' ? error?.message : undefined
            });
        }
        if (error?.code === '23503') { // Foreign key violation
            console.error('Database foreign key violation:', error);
            return res.status(400).json({
                error: 'Invalid user reference',
                details: process.env.NODE_ENV === 'development' ? error?.message : undefined
            });
        }
        if (error?.code === '23514') { // Check constraint violation
            console.error('Database check constraint violation:', error);
            return res.status(400).json({
                error: 'Invalid item data: constraint violation',
                details: process.env.NODE_ENV === 'development' ? error?.message : undefined
            });
        }
        // Handle database connection errors
        if (error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT' || error?.code === 'ENOTFOUND') {
            console.error('Database connection error:', error);
            return res.status(503).json({
                error: 'Database connection failed',
                details: process.env.NODE_ENV === 'development' ? error?.message : undefined
            });
        }
        // Handle JSON parsing errors
        if (error instanceof SyntaxError && error.message.includes('JSON')) {
            console.error('JSON parsing error:', error);
            return res.status(400).json({ error: 'Invalid JSON data' });
        }
        // Generic error handling
        console.error('Error creating item:', error);
        console.error('Error stack:', error?.stack);
        console.error('Error details:', {
            message: error?.message,
            name: error?.name,
            code: error?.code,
        });
        res.status(500).json({
            error: 'Failed to create item',
            details: process.env.NODE_ENV === 'development' ? error?.message : undefined
        });
    }
}
router.post('/', upload.array('attachments', 1000), handleCreateItem);
// Background function to process bookmarks
async function processBookmarksInBackground(userId, bookmarks, filePath) {
    const results = {
        imported: 0,
        failed: 0,
        skipped: 0,
        errors: [],
    };
    console.log(`Starting bookmark import for user ${userId}: ${bookmarks.length} bookmarks to process`);
    if (bookmarks.length > 0) {
        console.log(`Sample bookmark structure:`, JSON.stringify(bookmarks[0], null, 2));
    }
    // Get existing items once to check for duplicates
    let existingItems = [];
    try {
        existingItems = await ItemModel.findByOwner(userId, 1000, 0);
        console.log(`Found ${existingItems.length} existing items for duplicate check`);
    }
    catch (error) {
        console.error('Error fetching existing items for duplicate check:', error);
    }
    const existingUrls = new Set(existingItems.map(item => item.url).filter(Boolean));
    console.log(`Existing URLs set size: ${existingUrls.size}`);
    // Check user subscription tier for logging purposes
    const user = await UserModel.findById(userId);
    const subscriptionTier = user ? coerceSubscriptionTier(user.subscription_tier) : 'free';
    console.log(`Starting background processing for ${bookmarks.length} bookmarks (plan: ${subscriptionTier})`);
    // Process bookmarks sequentially to avoid overwhelming the system
    for (let i = 0; i < bookmarks.length; i++) {
        const bookmark = bookmarks[i];
        try {
            // Validate URL
            try {
                new URL(bookmark.url);
            }
            catch {
                results.failed++;
                results.errors.push(`Invalid URL: ${bookmark.url}`);
                if (i < 5)
                    console.log(`Invalid URL skipped: ${bookmark.url}`);
                continue;
            }
            // Skip if duplicate
            if (existingUrls.has(bookmark.url)) {
                results.skipped++;
                if (i < 5)
                    console.log(`Duplicate URL skipped: ${bookmark.url}`);
                continue;
            }
            const limitCheck = await checkItemCreationLimit(userId);
            if (limitCheck && limitCheck.status === 403) {
                console.log(`Item limit reached during bookmark import. Stopping at ${i} of ${bookmarks.length} bookmarks.`);
                results.errors.push(`Import stopped: ${limitCheck.message}. ${results.imported} bookmarks were successfully imported.`);
                break; // Stop importing more bookmarks
            }
            // Fetch metadata for the URL
            // Check if we already have metadata for this URL in existing items
            let linkMetadata = null;
            // First, check if any existing item with the same URL has complete metadata
            const existingItemWithMetadata = existingItems.find(existing => existing.url === bookmark.url &&
                existing.link_metadata &&
                (existing.link_metadata.title || existing.link_metadata.description || existing.link_metadata.image));
            if (existingItemWithMetadata?.link_metadata) {
                // Reuse existing metadata - no need to fetch again
                linkMetadata = existingItemWithMetadata.link_metadata;
                if (i < 5) {
                    console.log(`Reusing existing metadata for: ${bookmark.url}`);
                }
            }
            else {
                // Fetch metadata only if we don't have it
                try {
                    // Use longer timeout for metadata fetching (30 seconds)
                    linkMetadata = await linkMetadataService.fetchMetadata(bookmark.url, 3, 30000);
                    if (i < 5) {
                        console.log(`Fetched metadata for: ${bookmark.url}`, {
                            hasTitle: !!linkMetadata?.title,
                            hasDescription: !!linkMetadata?.description,
                            hasImage: !!linkMetadata?.image,
                        });
                    }
                }
                catch (error) {
                    // Log error but continue - metadata fetch is best effort
                    console.warn(`Failed to fetch metadata for ${bookmark.url}:`, error.message);
                    // Still create item with basic metadata
                    linkMetadata = {
                        url: bookmark.url,
                        title: bookmark.title || bookmark.url,
                    };
                }
            }
            // Use metadata title/description if available, otherwise use bookmark title
            const title = linkMetadata?.title || bookmark.title || bookmark.url;
            const description = linkMetadata?.description || undefined;
            // Ensure link_metadata is always saved (even if fetch partially failed)
            const metadataToSave = linkMetadata && (linkMetadata.title || linkMetadata.description || linkMetadata.image)
                ? linkMetadata
                : undefined;
            // Create item
            const item = await ItemModel.create({
                owner_id: userId,
                title: title,
                description: description,
                url: bookmark.url,
                source: 'bookmark',
                link_metadata: metadataToSave,
                tags: bookmark.folder ? [bookmark.folder] : undefined,
            });
            if (i < 5)
                console.log(`Created item ${item.id} for bookmark: ${bookmark.url}`);
            // Add to existing URLs set to avoid duplicates within this batch
            existingUrls.add(bookmark.url);
            // Trigger indexing in background (don't await - let it run async)
            indexingService.indexItem(item).catch((indexError) => {
                console.error(`Background indexing failed for bookmark item ${item.id}:`, indexError);
            });
            results.imported++;
            // Log progress every 50 items
            if (results.imported % 50 === 0) {
                console.log(`Progress: ${results.imported} imported, ${results.failed} failed, ${results.skipped} skipped out of ${i + 1} processed`);
            }
        }
        catch (error) {
            results.failed++;
            results.errors.push(`Failed to import ${bookmark.url}: ${error.message}`);
            console.error(`Error importing bookmark ${bookmark.url}:`, error);
            if (i < 5)
                console.error(`Error details:`, error.stack);
            // Continue processing other bookmarks
        }
    }
    // Clean up uploaded file after processing
    try {
        fs.unlinkSync(filePath);
    }
    catch (cleanupError) {
        console.warn('Failed to clean up bookmark file:', cleanupError);
    }
    console.log(`Bookmark import completed: ${results.imported} imported, ${results.failed} failed, ${results.skipped} skipped out of ${bookmarks.length} total`);
    if (results.errors.length > 0) {
        console.error('Bookmark import errors (first 10):', results.errors.slice(0, 10));
    }
}
// Import bookmarks from HTML file
router.post('/import-bookmarks', upload.single('bookmarkFile'), async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No bookmark file provided' });
        }
        // Validate user ID
        if (!req.user.id || typeof req.user.id !== 'string') {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        // Get user to check premium status
        const user = await UserModel.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Parse bookmark file
        const bookmarkFile = req.file;
        const filePath = fileStorageService.getFilePath(bookmarkFile.filename);
        let bookmarks;
        try {
            bookmarks = await bookmarkParserService.parseBookmarkFile(filePath);
        }
        catch (parseError) {
            console.error('Error parsing bookmark file:', parseError);
            // Clean up file on parse error
            try {
                fs.unlinkSync(filePath);
            }
            catch {
                // Ignore cleanup errors
            }
            return res.status(400).json({
                error: 'Failed to parse bookmark file',
                details: parseError.message
            });
        }
        if (bookmarks.length === 0) {
            // Clean up file if no bookmarks found
            try {
                fs.unlinkSync(filePath);
            }
            catch {
                // Ignore cleanup errors
            }
            return res.status(400).json({ error: 'No bookmarks found in file' });
        }
        // Check subscription limit before queuing import
        const limitCheck = await checkItemCreationLimit(req.user.id);
        if (limitCheck && limitCheck.status === 403) {
            // Clean up file
            try {
                fs.unlinkSync(filePath);
            }
            catch {
                // Ignore cleanup errors
            }
            return res.status(403).json({
                error: limitCheck.error,
                message: limitCheck.message,
                itemCount: limitCheck.itemCount,
                limit: limitCheck.limit,
                subscriptionTier: limitCheck.subscriptionTier,
            });
        }
        // Start processing in background (don't await)
        processBookmarksInBackground(req.user.id, bookmarks, filePath).catch((error) => {
            console.error('Background bookmark processing error:', error);
            console.error('Error stack:', error.stack);
        });
        // Return immediately
        res.status(202).json({
            message: 'Bookmark import started',
            total: bookmarks.length,
            note: 'Processing will happen in the background. Bookmarks will appear in your list as they are imported.',
            premium: user.is_premium || false,
        });
    }
    catch (error) {
        console.error('Error importing bookmarks:', error);
        res.status(500).json({
            error: 'Failed to import bookmarks',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});
// Get total indexed item count and limit status
router.get('/count', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const source = req.query.source;
        const hasAttachments = req.query.hasAttachments === 'true' || req.query.hasAttachments === true;
        const fileType = req.query.fileType;
        const filters = {};
        if (source) {
            filters.source = source;
        }
        if (hasAttachments) {
            filters.hasAttachments = true;
        }
        if (fileType) {
            filters.fileType = fileType;
        }
        const hasActiveFilters = Object.keys(filters).length > 0;
        const limitStatus = await getItemLimitStatus(req.user.id);
        const filteredCount = hasActiveFilters
            ? await ItemModel.countIndexedByOwner(req.user.id, filters)
            : limitStatus.itemCount;
        res.json({
            count: limitStatus.itemCount,
            filteredCount,
            isAtLimit: limitStatus.isAtLimit,
            isApproachingLimit: limitStatus.isApproachingLimit,
            limit: limitStatus.limit,
            subscriptionTier: limitStatus.subscriptionTier,
            planName: limitStatus.planName,
        });
    }
    catch (error) {
        console.error('Error getting item count:', error);
        res.status(500).json({ error: 'Failed to get item count' });
    }
});
router.get('/export', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const formatParam = req.query.format?.toLowerCase();
        const format = formatParam === 'csv' ? 'csv' : 'json';
        const items = await ItemModel.findAllByOwner(req.user.id);
        const exportItems = items.map((item) => {
            const normalized = normalizeItem(item);
            const safeItem = {
                ...normalized,
                created_at: normalized.created_at instanceof Date ? normalized.created_at.toISOString() : normalized.created_at,
                updated_at: normalized.updated_at instanceof Date ? normalized.updated_at.toISOString() : normalized.updated_at,
                deleted_at: normalized.deleted_at instanceof Date ? normalized.deleted_at.toISOString() : normalized.deleted_at,
            };
            if (safeItem.attachments && typeof safeItem.attachments === 'string') {
                try {
                    safeItem.attachments = JSON.parse(safeItem.attachments);
                }
                catch {
                    // leave as-is if parsing fails
                }
            }
            if (!safeItem.attachments) {
                safeItem.attachments = [];
            }
            if (safeItem.tags && typeof safeItem.tags === 'string') {
                try {
                    safeItem.tags = JSON.parse(safeItem.tags);
                }
                catch {
                    // leave as-is if parsing fails
                }
            }
            return safeItem;
        });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        if (format === 'json') {
            const filename = `items-export-${timestamp}.json`;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(JSON.stringify(exportItems, null, 2));
            return;
        }
        const columns = Array.from(exportItems.reduce((acc, item) => {
            Object.keys(item).forEach((key) => acc.add(key));
            return acc;
        }, new Set()));
        if (columns.length === 0) {
            columns.push('id');
        }
        const serializeValue = (value) => {
            if (value === null || value === undefined) {
                return '';
            }
            if (value instanceof Date) {
                return value.toISOString();
            }
            if (typeof value === 'object') {
                try {
                    return JSON.stringify(value);
                }
                catch {
                    return String(value);
                }
            }
            return String(value);
        };
        const escapeCsvValue = (value) => {
            if (value.includes('"')) {
                value = value.replace(/"/g, '""');
            }
            if (/[",\n\r]/.test(value)) {
                return `"${value}"`;
            }
            return value;
        };
        const csvLines = [
            columns.map((col) => escapeCsvValue(col)).join(','),
            ...exportItems.map((item) => columns
                .map((col) => {
                const rawValue = Object.prototype.hasOwnProperty.call(item, col) ? item[col] : '';
                return escapeCsvValue(serializeValue(rawValue));
            })
                .join(',')),
        ];
        const filename = `items-export-${timestamp}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csvLines.join('\n'));
    }
    catch (error) {
        console.error('Error exporting items:', error);
        res.status(500).json({ error: 'Failed to export items' });
    }
});
// List items
router.get('/', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        const source = req.query.source;
        const hasAttachments = req.query.hasAttachments === 'true' || req.query.hasAttachments === true;
        const fileType = req.query.fileType;
        const filters = {};
        if (source) {
            filters.source = source;
        }
        if (hasAttachments) {
            filters.hasAttachments = true;
        }
        if (fileType) {
            filters.fileType = fileType;
        }
        const items = await ItemModel.findByOwner(req.user.id, limit, offset, filters);
        res.json(items.map((item) => normalizeItem(item)));
    }
    catch (error) {
        console.error('Error listing items:', error);
        res.status(500).json({ error: 'Failed to list items' });
    }
});
// Get item by ID
router.get('/:id', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const item = await ItemModel.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        const hasAccess = item.owner_id === req.user.id ||
            (await ItemAccessModel.userHasAccess(item.id, req.user.id, req.user.email));
        if (!hasAccess) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        res.json(normalizeItem(item));
    }
    catch (error) {
        console.error('Error getting item:', error);
        res.status(500).json({ error: 'Failed to get item' });
    }
});
// Get link metadata (fetches and saves if not already saved)
router.get('/:id/metadata', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const item = await ItemModel.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        const hasAccess = item.owner_id === req.user.id ||
            (await ItemAccessModel.userHasAccess(item.id, req.user.id, req.user.email));
        if (!hasAccess) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (!item.url) {
            return res.status(400).json({ error: 'Item does not have a URL' });
        }
        // If metadata already exists and is complete, return it immediately
        // We consider metadata complete if it has a meaningful title (not just the URL) AND (description or image)
        const existingMetadata = item.link_metadata;
        const hasTitle = existingMetadata?.title && existingMetadata.title !== item.url && existingMetadata.title.length > 0;
        const hasDescription = existingMetadata?.description && existingMetadata.description.length > 0;
        const hasImage = existingMetadata?.image && existingMetadata.image.length > 0;
        const hasCompleteMetadata = hasTitle && (hasDescription || hasImage);
        if (hasCompleteMetadata) {
            return res.json(item.link_metadata);
        }
        // Fetch metadata and save it to the database
        // Use longer timeout for user-requested metadata fetch
        const metadata = await linkMetadataService.fetchMetadata(item.url || item.raw || '', 3, 30000);
        // Only save if we got meaningful metadata
        if (metadata && (metadata.title || metadata.description || metadata.image)) {
            // Save metadata to database
            await ItemModel.update(item.id, { link_metadata: metadata });
            // Re-index item to include metadata in search
            indexingService.indexItem(item).catch((indexError) => {
                console.error(`Background re-indexing failed for item ${item.id}:`, indexError);
            });
        }
        res.json(metadata);
    }
    catch (error) {
        console.error('Error fetching link metadata:', error);
        res.status(500).json({ error: 'Failed to fetch link metadata' });
    }
});
// Trigger indexing
router.post('/:id/index', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const item = await ItemModel.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        if (item.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        await indexingService.indexItem(item);
        res.json({ message: 'Indexing started' });
    }
    catch (error) {
        console.error('Error indexing item:', error);
        res.status(500).json({ error: 'Failed to index item' });
    }
});
router.post('/:id/share', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { email } = req.body ?? {};
        const trimmedEmail = typeof email === 'string' ? email.trim() : '';
        if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
            return res.status(400).json({ error: 'A valid email address is required.' });
        }
        const item = await ItemModel.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        if (item.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const normalizedItem = normalizeItem(item);
        const baseUrl = resolveFrontendBaseUrl();
        const shareUrl = baseUrl ? `${baseUrl}/items/${normalizedItem.id}` : `/items/${normalizedItem.id}`;
        await ItemAccessModel.grantAccess(item.id, trimmedEmail, { grantedByUserId: req.user.id });
        await searchService.invalidateForItem(item.id);
        await emailService.sendItemShareEmail({
            to: trimmedEmail,
            item: normalizedItem,
            shareUrl,
            senderEmail: req.user.email,
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error sending item share email:', error);
        res.status(500).json({ error: 'Failed to send item share email.' });
    }
});
// Post item to profile
router.post('/:id/post-to-profile', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const item = await ItemModel.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        if (item.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const updatedItem = await ItemModel.update(item.id, { posted_to_profile: true });
        res.json(normalizeItem(updatedItem));
    }
    catch (error) {
        console.error('Error posting item to profile:', error);
        res.status(500).json({ error: 'Failed to post item to profile.' });
    }
});
// Remove item from profile
router.delete('/:id/post-to-profile', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const item = await ItemModel.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        if (item.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const updatedItem = await ItemModel.update(item.id, { posted_to_profile: false });
        res.json(normalizeItem(updatedItem));
    }
    catch (error) {
        console.error('Error removing item from profile:', error);
        res.status(500).json({ error: 'Failed to remove item from profile.' });
    }
});
// Update item (unified structure)
router.patch('/:id', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const item = await ItemModel.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        if (item.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const { title, description, url, tags, notes } = req.body;
        const updates = {};
        // Update unified fields
        if (title !== undefined) {
            updates.title = title || null;
        }
        if (description !== undefined) {
            updates.description = description || null;
        }
        if (url !== undefined) {
            updates.url = url || null;
        }
        if (tags !== undefined) {
            updates.tags = Array.isArray(tags) ? tags : undefined;
        }
        if (notes !== undefined) {
            updates.notes = typeof notes === 'string' ? notes : undefined;
        }
        if (Object.keys(updates).length === 0) {
            return res.json(item);
        }
        const updatedItem = await ItemModel.update(item.id, updates);
        // Re-index item if content was updated
        if (title !== undefined || description !== undefined || url !== undefined || notes !== undefined) {
            indexingService.indexItem(updatedItem).catch((indexError) => {
                console.error(`Background re-indexing failed for item ${item.id}:`, indexError);
            });
        }
        res.json(normalizeItem(updatedItem));
    }
    catch (error) {
        console.error('Error updating item:', error);
        res.status(500).json({ error: 'Failed to update item' });
    }
});
// Update item notes (primarily for links)
router.patch('/:id/notes', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const item = await ItemModel.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        if (item.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const { notes } = req.body;
        if (notes !== undefined && typeof notes !== 'string') {
            return res.status(400).json({ error: 'Notes must be a string' });
        }
        const updatedItem = await ItemModel.update(item.id, { notes: notes || null });
        // Re-index item to include notes in search
        indexingService.indexItem(updatedItem).catch((indexError) => {
            console.error(`Background re-indexing failed for item ${item.id}:`, indexError);
        });
        res.json(normalizeItem(updatedItem));
    }
    catch (error) {
        console.error('Error updating item notes:', error);
        res.status(500).json({ error: 'Failed to update item notes' });
    }
});
// Delete item
router.delete('/:id', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const item = await ItemModel.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        if (item.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        await ItemModel.delete(req.params.id);
        await searchService.invalidateForItem(item.id);
        await indexingService.removeSearchDocument('item', item.id);
        res.json({ message: 'Item deleted' });
    }
    catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).json({ error: 'Failed to delete item' });
    }
});
// Generate email summary for an item (by item ID)
router.post('/:id/email-summary', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const item = await ItemModel.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        if (item.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        // Check if this is an email item
        if (item.type !== 'email') {
            return res.status(400).json({ error: 'Item is not an email' });
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
        // Get email body from description or raw field
        let emailBody = item.description || '';
        // Try to extract from raw field if description is empty
        if (!emailBody && item.raw) {
            try {
                const rawData = JSON.parse(item.raw);
                emailBody = rawData.text || rawData.body || rawData.html || '';
            }
            catch {
                // If parsing fails, use raw as-is
                emailBody = item.raw;
            }
        }
        if (!emailBody || emailBody.trim().length === 0) {
            return res.status(400).json({ error: 'Email body is empty' });
        }
        // Check if email is too short to summarize (less than 500 characters)
        const textContent = emailBody.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (textContent.length < 500) {
            return res.json({ summary: [] });
        }
        // Generate summary using OpenAI
        const { openAIService } = await import('../services/openai.js');
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
// Mark an email item as spam (tag-based)
router.post('/:id/mark-spam', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const item = await ItemModel.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        if (item.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (item.type !== 'email') {
            return res.status(400).json({ error: 'Only email items can be marked as spam' });
        }
        const existingTags = Array.isArray(item.tags) ? item.tags : [];
        if (existingTags.includes('spam')) {
            return res.json(normalizeItem(item));
        }
        const updatedItem = await ItemModel.update(item.id, {
            tags: [...existingTags, 'spam'],
        });
        indexingService.indexItem(updatedItem).catch((error) => {
            console.error(`[Items] Failed to re-index spam-marked item ${item.id}:`, error);
        });
        res.json(normalizeItem(updatedItem));
    }
    catch (error) {
        console.error('Error marking item as spam:', error);
        res.status(500).json({ error: 'Failed to mark item as spam' });
    }
});
// Unmark an email item as spam (remove 'spam' tag)
router.post('/:id/unmark-spam', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const item = await ItemModel.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        if (item.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (item.type !== 'email') {
            return res.status(400).json({ error: 'Only email items can be unmarked as spam' });
        }
        const existingTags = Array.isArray(item.tags) ? item.tags : [];
        if (!existingTags.includes('spam')) {
            return res.json(normalizeItem(item));
        }
        const updatedItem = await ItemModel.update(item.id, {
            tags: existingTags.filter((tag) => tag !== 'spam'),
        });
        indexingService.indexItem(updatedItem).catch((error) => {
            console.error(`[Items] Failed to re-index spam-unmarked item ${item.id}:`, error);
        });
        res.json(normalizeItem(updatedItem));
    }
    catch (error) {
        console.error('Error unmarking item as spam:', error);
        res.status(500).json({ error: 'Failed to unmark item as spam' });
    }
});
// Get collections containing an item
router.get('/:id/collections', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const item = await ItemModel.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        const hasAccess = item.owner_id === req.user.id ||
            (await ItemAccessModel.userHasAccess(item.id, req.user.id, req.user.email));
        if (!hasAccess) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        // Only return collections owned by the user
        const collections = await CollectionItemModel.findByItem(req.params.id);
        const userCollections = collections.filter((c) => c.owner_id === req.user.id);
        res.json(userCollections);
    }
    catch (error) {
        console.error('Error getting item collections:', error);
        res.status(500).json({ error: 'Failed to get item collections' });
    }
});
export default router;
//# sourceMappingURL=items.js.map