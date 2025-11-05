import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import itemsRoutes from './routes/items.js';
import searchRoutes from './routes/search.js';
import generateRoutes from './routes/generate.js';
import emailRoutes from './routes/email.js';
import './config/database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5555;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Create parser middleware instances
const jsonParser = express.json();
const urlencodedParser = express.urlencoded({ extended: true });

// Conditional body parsing - skip multipart/form-data (handled by multer)
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const contentType = req.headers['content-type'] || '';

  // Debug logging (remove after testing)
  if (req.method === 'POST' && req.path.includes('/items')) {
    console.log(`[DEBUG] ${req.method} ${req.path} - Content-Type: ${contentType}`);
  }

  // Skip parsing for multipart/form-data - let multer handle it
  if (contentType.includes('multipart/form-data')) {
    if (req.method === 'POST' && req.path.includes('/items')) {
      console.log('[DEBUG] Skipping body parsing for multipart/form-data');
    }
    return next();
  }

  // Skip parsing for GET/HEAD/OPTIONS requests (no body)
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  // Skip parsing if no content-type (might be empty body)
  if (!contentType) {
    return next();
  }

  // Apply appropriate parser based on content-type
  if (contentType.includes('application/json')) {
    return jsonParser(req, res, next);
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    return urlencodedParser(req, res, next);
  }

  // For other content types, skip parsing
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/email', emailRoutes);

// Health check
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Handle body parser errors (wrong Content-Type)
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    console.error('Body parsing error:', err.message);
    console.error('Request Content-Type:', req.headers['content-type']);
    console.error('Request path:', req.path);

    // Check if this is a multipart/form-data being parsed as JSON
    if (err.message && err.message.includes('JSON') && req.headers['content-type']?.includes('application/json')) {
      return res.status(400).json({
        error: 'Invalid Content-Type',
        details: 'Request appears to be multipart/form-data but Content-Type is application/json. Please use FormData without manually setting Content-Type header.'
      });
    }

    return res.status(400).json({
      error: 'Invalid request body',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }

  // Handle other errors
  console.error('Unhandled error:', err);
  console.error('Error stack:', err?.stack);
  console.error('Request path:', req.path);
  console.error('Request method:', req.method);
  res.status(500).json({
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err?.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
