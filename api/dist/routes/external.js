import express from 'express';
import { apiKeyAuthMiddleware } from '../middleware/apiKeyAuth.js';
import { ItemModel } from '../models/Item.js';
import { normalizeItem } from '../utils/itemNormalization.js';
import { searchService } from '../services/search.js';
import { upload as itemUpload, handleCreateItem } from './items.js';
const router = express.Router();
router.use(apiKeyAuthMiddleware);
router.post('/items', itemUpload.array('attachments', 1000), async (req, res) => {
    try {
        if (!req.apiUser) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        req.user = { id: req.apiUser.id, email: req.apiUser.email };
        await handleCreateItem(req, res);
    }
    catch (error) {
        console.error('[External API] Failed to create item:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to create item' });
        }
    }
});
router.get('/items', async (req, res) => {
    try {
        if (!req.apiUser) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const limitParam = parseInt(req.query.limit, 10);
        const offsetParam = parseInt(req.query.offset, 10);
        const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;
        const offset = Number.isFinite(offsetParam) ? Math.max(offsetParam, 0) : 0;
        const items = await ItemModel.findByOwner(req.apiUser.id, limit, offset);
        const normalized = items.map((item) => normalizeItem(item));
        res.json({
            items: normalized,
            pagination: {
                limit,
                offset,
                count: normalized.length,
                nextOffset: offset + normalized.length,
            },
        });
    }
    catch (error) {
        console.error('[External API] Failed to list items:', error);
        res.status(500).json({ error: 'Failed to list items' });
    }
});
router.get('/items/:id', async (req, res) => {
    try {
        if (!req.apiUser) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const item = await ItemModel.findById(req.params.id);
        if (!item || item.owner_id !== req.apiUser.id) {
            return res.status(404).json({ error: 'Item not found' });
        }
        res.json(normalizeItem(item));
    }
    catch (error) {
        console.error('[External API] Failed to fetch item:', error);
        res.status(500).json({ error: 'Failed to fetch item' });
    }
});
router.get('/search', async (req, res) => {
    try {
        if (!req.apiUser) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const query = req.query.q;
        if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: 'Query parameter "q" is required' });
        }
        const limitParam = parseInt(req.query.limit, 10);
        const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 10;
        const results = await searchService.search(req.apiUser.id, query, limit);
        res.json({
            query,
            results: results.map((result) => ({
                item: normalizeItem(result.item),
                similarity: result.similarity,
                source: result.item.source,
            })),
        });
    }
    catch (error) {
        console.error('[External API] Failed to search items:', error);
        res.status(500).json({ error: 'Failed to search items' });
    }
});
export default router;
//# sourceMappingURL=external.js.map