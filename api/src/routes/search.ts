import express from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { searchService } from '../services/search.js';
import type { SearchFilters } from '../types/search.js';

const router = express.Router();
router.use(authMiddleware);

// Semantic search
router.get('/', async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required' });
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

    const limitParam =
      typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;
    if (Number.isNaN(limitParam ?? 0)) {
      return res.status(400).json({ error: 'Invalid limit parameter' });
    }
    const limit = limitParam ? Math.min(Math.max(limitParam, 1), 50) : 10;

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
    const entities = toArray(req.query.entity ?? req.query.entities);
    if (entities.length > 0) {
      const validEntities = entities
        .map((value) => value.toLowerCase())
        .filter((value): value is 'item' | 'contact' => value === 'item' || value === 'contact');
      if (validEntities.length > 0) {
        filters.entities = validEntities;
      }
    }
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

    const fileTypeParam =
      typeof req.query.fileType === 'string' ? req.query.fileType.trim().toLowerCase() : undefined;
    if (fileTypeParam) {
      filters.fileType = fileTypeParam;
    }

    const results = await searchService.search(
      { id: req.user.id, email: req.user.email },
      q,
      limit,
      filters
    );

    res.json({
      query: q,
      results: results.map((result) => ({
        entityType: result.entityType,
        entityId: result.entityId,
        item: result.item,
        contact: result.contact,
        document: result.document,
        similarity: result.similarity,
        scores: result.scores,
      })),
    });
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ error: 'Failed to search' });
  }
});

export default router;
