import express from 'express';
import type { ApiKeyRequest } from '../middleware/apiKeyAuth.js';
import { apiKeyAuthMiddleware } from '../middleware/apiKeyAuth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { ItemModel } from '../models/Item.js';
import { normalizeItem } from '../utils/itemNormalization.js';
import { searchService } from '../services/search.js';
import type { SearchFilters } from '../types/search.js';
import { upload as itemUpload, handleCreateItem } from './items.js';

const router = express.Router();

router.use(apiKeyAuthMiddleware);

router.post('/items', itemUpload.array('attachments', 1000), async (req: ApiKeyRequest, res: express.Response) => {
  try {
    if (!req.apiUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.user = { id: req.apiUser.id, email: req.apiUser.email };

    await handleCreateItem(req as unknown as AuthRequest, res);
  } catch (error) {
    console.error('[External API] Failed to create item:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to create item' });
    }
  }
});

router.get('/items', async (req: ApiKeyRequest, res: express.Response) => {
  try {
    if (!req.apiUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const limitParam = parseInt(req.query.limit as string, 10);
    const offsetParam = parseInt(req.query.offset as string, 10);
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
  } catch (error) {
    console.error('[External API] Failed to list items:', error);
    res.status(500).json({ error: 'Failed to list items' });
  }
});

router.get('/items/:id', async (req: ApiKeyRequest, res: express.Response) => {
  try {
    if (!req.apiUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const item = await ItemModel.findById(req.params.id);

    if (!item || item.owner_id !== req.apiUser.id) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json(normalizeItem(item));
  } catch (error) {
    console.error('[External API] Failed to fetch item:', error);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

router.get('/search', async (req: ApiKeyRequest, res: express.Response) => {
  try {
    if (!req.apiUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const query = req.query.q;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const toArray = (value: unknown): string[] => {
      if (Array.isArray(value)) {
        return value
          .flatMap((entry) => entry.split(','))
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0);
      }
      if (typeof value === 'string') {
        return value
          .split(',')
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0);
      }
      return [];
    };

    const limitParam = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;
    if (Number.isNaN(limitParam ?? 0)) {
      return res.status(400).json({ error: 'Invalid limit parameter' });
    }
    const limit = limitParam ? Math.min(Math.max(limitParam, 1), 50) : 10;

    const offsetParam =
      typeof req.query.offset === 'string' ? parseInt(req.query.offset, 10) : undefined;
    if (offsetParam !== undefined && Number.isNaN(offsetParam)) {
      return res.status(400).json({ error: 'Invalid offset parameter' });
    }
    const offset = offsetParam ? Math.max(offsetParam, 0) : 0;

    const uploadedByParam = typeof req.query.uploadedBy === 'string' ? req.query.uploadedBy.trim().toLowerCase() : undefined;
    if (uploadedByParam && !['me', 'shared', 'all'].includes(uploadedByParam)) {
      return res.status(400).json({ error: 'uploadedBy must be one of: me, shared, all' });
    }

    const hasAttachmentsParam = typeof req.query.hasAttachments === 'string'
      ? req.query.hasAttachments.trim().toLowerCase()
      : undefined;
    if (hasAttachmentsParam && !['true', 'false'].includes(hasAttachmentsParam)) {
      return res.status(400).json({ error: 'hasAttachments must be "true" or "false"' });
    }

    const parseDateParam = (value: unknown): string | undefined => {
      if (typeof value !== 'string' || value.trim().length === 0) {
        return undefined;
      }
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return undefined;
      }
      return date.toISOString();
    };

    const filters: SearchFilters = {};
    const types = toArray(req.query.type ?? req.query.types);
    if (types.length > 0) {
      filters.types = types;
    }
    const tags = toArray(req.query.tag ?? req.query.tags);
    if (tags.length > 0) {
      filters.tags = tags;
    }
    const sources = toArray(req.query.source ?? req.query.sources);
    if (sources.length > 0) {
      filters.sources = sources;
    }
    if (uploadedByParam && uploadedByParam !== 'all') {
      filters.uploadedBy = uploadedByParam as 'me' | 'shared';
    }
    if (hasAttachmentsParam === 'true') {
      filters.hasAttachments = true;
    }

    const dateFrom = parseDateParam(req.query.dateFrom);
    if (req.query.dateFrom && !dateFrom) {
      return res.status(400).json({ error: 'Invalid dateFrom parameter' });
    }
    if (dateFrom) {
      filters.dateFrom = dateFrom;
    }

    const dateTo = parseDateParam(req.query.dateTo);
    if (req.query.dateTo && !dateTo) {
      return res.status(400).json({ error: 'Invalid dateTo parameter' });
    }
    if (dateTo) {
      filters.dateTo = dateTo;
    }

    const results = await searchService.search(
      { id: req.apiUser.id, email: req.apiUser.email },
      query,
      limit,
      filters,
      offset
    );

    res.json({
      query,
      results: results.map((result) => ({
        item: normalizeItem(result.item),
        similarity: result.similarity,
        source: result.item.source,
        scores: result.scores,
      })),
    });
  } catch (error) {
    console.error('[External API] Failed to search items:', error);
    res.status(500).json({ error: 'Failed to search items' });
  }
});

export default router;
