import express from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { searchService } from '../services/search.js';

const router = express.Router();
router.use(authMiddleware);

// Semantic search
router.get('/', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const results = await searchService.search(req.user.id, q, 10);

    res.json({
      query: q,
      results: results.map((result) => ({
        item: result.item,
        similarity: result.similarity,
        source: result.item.source,
      })),
    });
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ error: 'Failed to search' });
  }
});

export default router;
