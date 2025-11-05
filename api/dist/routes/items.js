import express from 'express';
import { ItemModel } from '../models/Item.js';
import { authMiddleware } from '../middleware/auth.js';
import { indexingService } from '../services/indexing.js';
import { linkMetadataService } from '../services/linkMetadata.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileStorageService } from '../services/storage.js';
import { fileParserService } from '../services/fileParser.js';
import { openAIService } from '../services/openai.js';
import { bookmarkParserService } from '../services/bookmarkParser.js';
import { UserModel } from '../models/User.js';
import pool from '../config/database.js';
const router = express.Router();
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
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});
const upload = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
    },
});
// Create item (unified structure)
router.post('/', upload.array('attachments', 10), async (req, res, next) => {
    try {
        // Log incoming request for debugging
        console.log('[DEBUG] Creating item - body:', req.body);
        console.log('[DEBUG] Files:', req.files);
        const { title, description, url, notes, tags } = req.body;
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Validate user ID exists (defensive check)
        if (!req.user.id || typeof req.user.id !== 'string') {
            console.error('Invalid user ID:', req.user.id);
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        // Validate that at least one field is provided
        if (!title && !description && !url && (!req.files || req.files.length === 0)) {
            return res.status(400).json({
                error: 'Invalid item data',
                details: 'Must provide at least title, description, URL, or attachments'
            });
        }
        // Process file attachments if present
        let attachments = [];
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
            attachments = req.files.map((file) => ({
                filename: file.filename,
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
            }));
        }
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
        if ((!finalTitle || !finalDescription) && req.files && Array.isArray(req.files) && req.files.length > 0) {
            try {
                // Use the first file for auto-filling title/description
                const firstFile = req.files[0];
                // Parse the file to extract content
                const parsedContent = await fileParserService.parseFile(firstFile.filename, firstFile.mimetype);
                if (parsedContent.text && parsedContent.text.trim().length > 0) {
                    // Generate title and description from file content using OpenAI
                    const generated = await openAIService.generateTitleAndDescription(parsedContent.text, firstFile.originalname);
                    // Only use generated values if the corresponding field is missing
                    if (!finalTitle) {
                        finalTitle = generated.title;
                    }
                    if (!finalDescription) {
                        finalDescription = generated.description;
                    }
                }
            }
            catch (error) {
                // Log error but don't fail the request - fallback to filename if title is missing
                console.error('Error auto-filling title/description from file:', error);
                if (!finalTitle && req.files && Array.isArray(req.files) && req.files.length > 0) {
                    const firstFile = req.files[0];
                    finalTitle = path.basename(firstFile.originalname, path.extname(firstFile.originalname));
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
                if (req.files && Array.isArray(req.files) && req.files.length > 0) {
                    try {
                        const firstFile = req.files[0];
                        const parsedContent = await fileParserService.parseFile(firstFile.filename, firstFile.mimetype);
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
        // Create item in database with unified structure
        const item = await ItemModel.create({
            owner_id: req.user.id,
            title: finalTitle || undefined,
            description: finalDescription || undefined,
            url: url || undefined,
            attachments: attachments.length > 0 ? attachments : undefined,
            notes: notes || undefined,
            tags: parsedTags,
            source: 'web',
            link_metadata: linkMetadata || undefined,
        });
        // Trigger indexing in background (don't await - let it run async)
        indexingService.indexItem(item.id).catch((indexError) => {
            console.error(`Background indexing failed for item ${item.id}:`, indexError);
            // Don't fail the request if indexing fails
        });
        res.status(201).json(item);
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
});
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
            // Fetch metadata for the URL
            let linkMetadata = null;
            try {
                linkMetadata = await linkMetadataService.fetchMetadata(bookmark.url);
                if (i < 5)
                    console.log(`Fetched metadata for: ${bookmark.url}`);
            }
            catch (error) {
                // Log but don't fail - we'll use bookmark title if metadata fails
                if (i < 5)
                    console.warn(`Failed to fetch metadata for ${bookmark.url}:`, error);
            }
            // Use metadata title/description if available, otherwise use bookmark title
            const title = linkMetadata?.title || bookmark.title || bookmark.url;
            const description = linkMetadata?.description || undefined;
            // Create item
            const item = await ItemModel.create({
                owner_id: userId,
                title: title,
                description: description,
                url: bookmark.url,
                source: 'bookmark',
                link_metadata: linkMetadata || undefined,
                tags: bookmark.folder ? [bookmark.folder] : undefined,
            });
            if (i < 5)
                console.log(`Created item ${item.id} for bookmark: ${bookmark.url}`);
            // Add to existing URLs set to avoid duplicates within this batch
            existingUrls.add(bookmark.url);
            // Trigger indexing in background (don't await - let it run async)
            indexingService.indexItem(item.id).catch((indexError) => {
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
        // Check premium status and payment requirements
        const isPremium = user.is_premium || false;
        const bookmarkCount = bookmarks.length;
        // paymentIntentId comes from FormData, access it from body
        const paymentIntentId = req.body?.paymentIntentId || undefined;
        // Premium users can import for free
        if (!isPremium) {
            // Check bookmark count limit
            if (bookmarkCount > 555) {
                // Clean up file
                try {
                    fs.unlinkSync(filePath);
                }
                catch {
                    // Ignore cleanup errors
                }
                return res.status(403).json({
                    error: 'Bookmark import limit exceeded',
                    message: 'You can import up to 555 bookmarks per payment. Please split your bookmarks into smaller files.',
                    limit: 555,
                    requested: bookmarkCount,
                });
            }
            // Require payment verification for non-premium users
            if (!paymentIntentId) {
                // Clean up file
                try {
                    fs.unlinkSync(filePath);
                }
                catch {
                    // Ignore cleanup errors
                }
                return res.status(402).json({
                    error: 'Payment required',
                    message: 'Bookmark import requires payment for non-premium users',
                    requiresPayment: true,
                    bookmarkCount,
                    amount: 1000, // $10 in cents
                    currency: 'usd',
                });
            }
            // Verify payment
            const { stripeService } = await import('../services/stripe.js');
            const isPaymentVerified = await stripeService.verifyPaymentIntent(paymentIntentId);
            if (!isPaymentVerified) {
                // Clean up file
                try {
                    fs.unlinkSync(filePath);
                }
                catch {
                    // Ignore cleanup errors
                }
                return res.status(402).json({
                    error: 'Payment verification failed',
                    message: 'Please complete payment before importing bookmarks',
                });
            }
            // Update user's bookmark import count after successful payment verification
            await UserModel.update(req.user.id, {
                bookmark_import_count: (user.bookmark_import_count || 0) + 1,
                last_bookmark_import_payment: new Date(),
            });
        }
        // Start processing in background (don't await)
        console.log(`Starting background processing for ${bookmarks.length} bookmarks (premium: ${isPremium})`);
        processBookmarksInBackground(req.user.id, bookmarks, filePath).catch((error) => {
            console.error('Background bookmark processing error:', error);
            console.error('Error stack:', error.stack);
        });
        // Return immediately
        res.status(202).json({
            message: 'Bookmark import started',
            total: bookmarks.length,
            note: 'Processing will happen in the background. Bookmarks will appear in your list as they are imported.',
            premium: isPremium,
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
// Get total indexed item count
router.get('/count', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const result = await pool.query('SELECT COUNT(*) as total FROM items WHERE owner_id = $1 AND embedding_id IS NOT NULL', [req.user.id]);
        res.json({ count: parseInt(result.rows[0].total, 10) });
    }
    catch (error) {
        console.error('Error getting item count:', error);
        res.status(500).json({ error: 'Failed to get item count' });
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
        const items = await ItemModel.findByOwner(req.user.id, limit, offset);
        res.json(items);
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
        if (item.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        res.json(item);
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
        if (item.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (!item.url) {
            return res.status(400).json({ error: 'Item does not have a URL' });
        }
        // If metadata already exists, return it
        if (item.link_metadata) {
            return res.json(item.link_metadata);
        }
        // Fetch metadata and save it to the database
        const metadata = await linkMetadataService.fetchMetadata(item.url || item.raw || '');
        // Save metadata to database
        await ItemModel.update(item.id, { link_metadata: metadata });
        // Re-index item to include metadata in search
        indexingService.indexItem(item.id).catch((indexError) => {
            console.error(`Background re-indexing failed for item ${item.id}:`, indexError);
        });
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
        await indexingService.indexItem(item.id);
        res.json({ message: 'Indexing started' });
    }
    catch (error) {
        console.error('Error indexing item:', error);
        res.status(500).json({ error: 'Failed to index item' });
    }
});
// Download file
router.get('/:id/files/:filename', async (req, res) => {
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
        if (!item.attachments || !Array.isArray(item.attachments) || item.attachments.length === 0) {
            return res.status(400).json({ error: 'Item does not have attachments' });
        }
        // Find file info from attachments array
        const fileInfo = item.attachments.find((f) => f.filename === req.params.filename);
        if (!fileInfo) {
            return res.status(404).json({ error: 'File not found in item' });
        }
        // Get file stream
        try {
            const fileStream = await fileStorageService.getFileStream(fileInfo.filename);
            // Set appropriate headers
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileInfo.originalname)}"`);
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
            indexingService.indexItem(item.id).catch((indexError) => {
                console.error(`Background re-indexing failed for item ${item.id}:`, indexError);
            });
        }
        res.json(updatedItem);
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
        indexingService.indexItem(item.id).catch((indexError) => {
            console.error(`Background re-indexing failed for item ${item.id}:`, indexError);
        });
        res.json(updatedItem);
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
export default router;
//# sourceMappingURL=items.js.map