import express from 'express';
import { CollectionModel } from '../models/Collection.js';
import { CollectionItemModel } from '../models/CollectionItem.js';
import { ItemModel } from '../models/Item.js';
import { authMiddleware } from '../middleware/auth.js';
import { normalizeItem } from '../utils/itemNormalization.js';
const router = express.Router();
// Public route: Get collection by share token (no auth required)
router.get('/shared/:token', async (req, res) => {
    try {
        const { token } = req.params;
        if (!token) {
            return res.status(400).json({ error: 'Share token is required' });
        }
        const collection = await CollectionModel.findByShareToken(token);
        if (!collection) {
            return res.status(404).json({ error: 'Collection not found or not publicly shareable' });
        }
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        // Get items in the collection
        const items = await CollectionItemModel.findByCollection(collection.id, limit, offset);
        const normalizedItems = items.map((item) => normalizeItem(item));
        const itemCount = await CollectionItemModel.countByCollection(collection.id);
        res.json({
            ...collection,
            item_count: itemCount,
            items: normalizedItems,
        });
    }
    catch (error) {
        console.error('Error getting shared collection:', error);
        res.status(500).json({ error: 'Failed to get shared collection' });
    }
});
router.use(authMiddleware);
// Create collection
router.post('/', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { title, description, color, icon } = req.body;
        if (!title || typeof title !== 'string' || title.trim().length === 0) {
            return res.status(400).json({ error: 'Title is required' });
        }
        if (title.length > 255) {
            return res.status(400).json({ error: 'Title must be 255 characters or less' });
        }
        // Validate color if provided (should be hex color code)
        if (color && typeof color === 'string' && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
            return res.status(400).json({ error: 'Color must be a valid hex color code (e.g., #FF5733)' });
        }
        // Validate icon if provided
        if (icon && typeof icon === 'string' && icon.length > 50) {
            return res.status(400).json({ error: 'Icon must be 50 characters or less' });
        }
        const collection = await CollectionModel.create({
            owner_id: req.user.id,
            title: title.trim(),
            description: description?.trim() || undefined,
            color: color?.trim() || undefined,
            icon: icon?.trim() || undefined,
        });
        res.status(201).json(collection);
    }
    catch (error) {
        console.error('Error creating collection:', error);
        res.status(500).json({ error: 'Failed to create collection' });
    }
});
// List user's collections
router.get('/', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const collections = await CollectionModel.findByOwner(req.user.id);
        // Get item counts for each collection
        const collectionsWithCounts = await Promise.all(collections.map(async (collection) => {
            const itemCount = await CollectionItemModel.countByCollection(collection.id);
            return {
                ...collection,
                item_count: itemCount,
            };
        }));
        res.json(collectionsWithCounts);
    }
    catch (error) {
        console.error('Error listing collections:', error);
        res.status(500).json({ error: 'Failed to list collections' });
    }
});
// Get collection details
router.get('/:id', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const collection = await CollectionModel.findById(req.params.id);
        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }
        if (collection.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const itemCount = await CollectionItemModel.countByCollection(collection.id);
        res.json({
            ...collection,
            item_count: itemCount,
        });
    }
    catch (error) {
        console.error('Error getting collection:', error);
        res.status(500).json({ error: 'Failed to get collection' });
    }
});
// Update collection
router.patch('/:id', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const collection = await CollectionModel.findById(req.params.id);
        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }
        if (collection.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const { title, description, color, icon } = req.body;
        const updates = {};
        if (title !== undefined) {
            if (typeof title !== 'string' || title.trim().length === 0) {
                return res.status(400).json({ error: 'Title cannot be empty' });
            }
            if (title.length > 255) {
                return res.status(400).json({ error: 'Title must be 255 characters or less' });
            }
            updates.title = title.trim();
        }
        if (description !== undefined) {
            updates.description = description === null || description === '' ? null : String(description).trim();
        }
        if (color !== undefined) {
            if (color !== null && color !== '' && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
                return res.status(400).json({ error: 'Color must be a valid hex color code (e.g., #FF5733)' });
            }
            updates.color = color === null || color === '' ? null : color.trim();
        }
        if (icon !== undefined) {
            if (icon !== null && icon !== '' && typeof icon === 'string' && icon.length > 50) {
                return res.status(400).json({ error: 'Icon must be 50 characters or less' });
            }
            updates.icon = icon === null || icon === '' ? null : icon.trim();
        }
        const updatedCollection = await CollectionModel.update(req.params.id, updates);
        const itemCount = await CollectionItemModel.countByCollection(updatedCollection.id);
        res.json({
            ...updatedCollection,
            item_count: itemCount,
        });
    }
    catch (error) {
        console.error('Error updating collection:', error);
        res.status(500).json({ error: 'Failed to update collection' });
    }
});
// Delete collection
router.delete('/:id', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const collection = await CollectionModel.findById(req.params.id);
        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }
        if (collection.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        await CollectionModel.delete(req.params.id);
        res.json({ message: 'Collection deleted' });
    }
    catch (error) {
        console.error('Error deleting collection:', error);
        res.status(500).json({ error: 'Failed to delete collection' });
    }
});
// Get items in collection
router.get('/:id/items', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const collection = await CollectionModel.findById(req.params.id);
        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }
        if (collection.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        const items = await CollectionItemModel.findByCollection(req.params.id, limit, offset);
        const normalizedItems = items.map((item) => normalizeItem(item));
        res.json(normalizedItems);
    }
    catch (error) {
        console.error('Error getting collection items:', error);
        res.status(500).json({ error: 'Failed to get collection items' });
    }
});
// Add item(s) to collection
router.post('/:id/items', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const collection = await CollectionModel.findById(req.params.id);
        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }
        if (collection.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const { itemIds } = req.body;
        if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
            return res.status(400).json({ error: 'itemIds array is required' });
        }
        // Filter out Resend email items (they have IDs starting with "resend-email-" and aren't in the database)
        const validItemIds = itemIds.filter((itemId) => {
            if (typeof itemId !== 'string') {
                return false;
            }
            // Resend emails have IDs like "resend-email-{uuid}" and can't be added to collections
            if (itemId.startsWith('resend-email-')) {
                return false;
            }
            // Validate UUID format
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            return uuidRegex.test(itemId);
        });
        if (validItemIds.length === 0) {
            return res.status(400).json({
                error: 'No valid items to add',
                message: 'Resend email items cannot be added to collections. Please import them as items first.'
            });
        }
        // Validate that all items exist and belong to the user
        for (const itemId of validItemIds) {
            const item = await ItemModel.findById(itemId);
            if (!item) {
                return res.status(404).json({ error: `Item ${itemId} not found` });
            }
            if (item.owner_id !== req.user.id) {
                return res.status(403).json({ error: `Item ${itemId} does not belong to you` });
            }
        }
        const addedCount = await CollectionItemModel.addItems(req.params.id, validItemIds);
        const skippedCount = itemIds.length - validItemIds.length;
        res.json({
            message: `Added ${addedCount} item(s) to collection${skippedCount > 0 ? ` (${skippedCount} skipped - Resend emails cannot be added to collections)` : ''}`,
            addedCount,
            totalRequested: itemIds.length,
            skippedCount,
        });
    }
    catch (error) {
        console.error('Error adding items to collection:', error);
        res.status(500).json({ error: 'Failed to add items to collection' });
    }
});
// Remove item from collection
router.delete('/:id/items/:itemId', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const collection = await CollectionModel.findById(req.params.id);
        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }
        if (collection.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const item = await ItemModel.findById(req.params.itemId);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        if (item.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const removed = await CollectionItemModel.removeItem(req.params.id, req.params.itemId);
        if (!removed) {
            return res.status(404).json({ error: 'Item not in collection' });
        }
        res.json({ message: 'Item removed from collection' });
    }
    catch (error) {
        console.error('Error removing item from collection:', error);
        res.status(500).json({ error: 'Failed to remove item from collection' });
    }
});
// Post collection to profile
router.post('/:id/post-to-profile', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const collection = await CollectionModel.findById(req.params.id);
        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }
        if (collection.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const updatedCollection = await CollectionModel.update(req.params.id, { posted_to_profile: true });
        const itemCount = await CollectionItemModel.countByCollection(updatedCollection.id);
        res.json({
            ...updatedCollection,
            item_count: itemCount,
        });
    }
    catch (error) {
        console.error('Error posting collection to profile:', error);
        res.status(500).json({ error: 'Failed to post collection to profile' });
    }
});
// Remove collection from profile
router.delete('/:id/post-to-profile', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const collection = await CollectionModel.findById(req.params.id);
        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }
        if (collection.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const updatedCollection = await CollectionModel.update(req.params.id, { posted_to_profile: false });
        const itemCount = await CollectionItemModel.countByCollection(updatedCollection.id);
        res.json({
            ...updatedCollection,
            item_count: itemCount,
        });
    }
    catch (error) {
        console.error('Error removing collection from profile:', error);
        res.status(500).json({ error: 'Failed to remove collection from profile' });
    }
});
// Update collection sharing settings
router.patch('/:id/sharing', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const collection = await CollectionModel.findById(req.params.id);
        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }
        if (collection.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const { is_publicly_shareable } = req.body;
        if (typeof is_publicly_shareable !== 'boolean') {
            return res.status(400).json({ error: 'is_publicly_shareable must be a boolean' });
        }
        let updatedCollection;
        if (is_publicly_shareable) {
            // Enable sharing - generate token if not exists
            if (!collection.share_token) {
                updatedCollection = await CollectionModel.generateShareToken(req.params.id);
            }
            else {
                updatedCollection = await CollectionModel.update(req.params.id, { is_publicly_shareable: true });
            }
        }
        else {
            // Disable sharing - clear token
            updatedCollection = await CollectionModel.update(req.params.id, {
                is_publicly_shareable: false,
                share_token: null,
            });
        }
        const itemCount = await CollectionItemModel.countByCollection(updatedCollection.id);
        res.json({
            ...updatedCollection,
            item_count: itemCount,
        });
    }
    catch (error) {
        console.error('Error updating collection sharing:', error);
        res.status(500).json({ error: 'Failed to update collection sharing' });
    }
});
// Get share token (or generate if not exists)
router.get('/:id/share-token', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const collection = await CollectionModel.findById(req.params.id);
        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }
        if (collection.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        let shareToken = collection.share_token;
        // Generate token if not exists and sharing is enabled
        if (!shareToken && collection.is_publicly_shareable) {
            const updated = await CollectionModel.generateShareToken(req.params.id);
            shareToken = updated.share_token || null;
        }
        res.json({ share_token: shareToken });
    }
    catch (error) {
        console.error('Error getting share token:', error);
        res.status(500).json({ error: 'Failed to get share token' });
    }
});
export default router;
//# sourceMappingURL=collections.js.map