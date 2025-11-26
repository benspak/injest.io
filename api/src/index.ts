import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import helmet from 'helmet';
import authRoutes from './routes/auth.js';
import itemsRoutes from './routes/items.js';
import searchRoutes from './routes/search.js';
import generateRoutes from './routes/generate.js';
import emailRoutes from './routes/email.js';
import feedbackRoutes from './routes/feedback.js';
import paymentRoutes from './routes/payment.js';
import contactsRoutes from './routes/contacts.js';
import sendRoutes from './routes/send.js';
import profilesRoutes from './routes/profiles.js';
import collectionsRoutes from './routes/collections.js';
import externalRoutes from './routes/external.js';
import slackRoutes from './routes/slack.js';
import referralRoutes from './routes/referral.js';
import stripeWebhookRoutes from './routes/stripe-webhook.js';
import './config/database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5555;

// Security headers middleware (must be before other middleware)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for compatibility
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"], // Allow images from HTTPS and data URIs
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable if causing issues with third-party integrations
}));

// Middleware
// Configure CORS with security best practices
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : ['http://localhost:3000', 'http://localhost:3001'];

// In production, use strict whitelist
const productionOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : [];

// Webhook endpoints that don't send Origin headers (server-to-server requests)
const webhookPaths = ['/api/email/inbound', '/api/stripe-webhook'];

// File endpoints that may not send Origin headers (e.g., when loaded in <img> tags)
const isFileRequest = (path: string): boolean => {
  // Match pattern: /api/items/:id/files/:filename
  if (/^\/api\/items\/[^/]+\/files\/.+$/.test(path)) {
    return true;
  }
  // Match pattern: /api/email/attachments/:itemId/:attachmentId
  if (/^\/api\/email\/attachments\/[^/]+\/[^/]+$/.test(path)) {
    return true;
  }
  return false;
};

app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Check if this is a webhook endpoint
  const isWebhookRequest = webhookPaths.some(path => req.path.startsWith(path));
  // Check if this is a file request
  const isFileEndpoint = isFileRequest(req.path);

  // Helper to check if request has authentication token
  const hasAuthToken = (req: express.Request): boolean => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        return true;
      }
      // Check for token in query string (used for file endpoints)
      // Note: Express automatically parses query strings, so req.query should be available
      if (req.query && req.query.token && typeof req.query.token === 'string' && req.query.token.length > 0) {
        return true;
      }
    } catch (error) {
      // If there's any error checking for token, assume no token (fail secure)
      console.error('Error checking for auth token in CORS middleware:', error);
      return false;
    }
    return false;
  };

  // Apply CORS with webhook-aware origin handling
  cors({
    origin: (origin, callback) => {
      try {
        // In production, be more restrictive about requests with no origin
        if (!origin) {
          // Allow webhook endpoints without Origin header (server-to-server)
          if (isWebhookRequest) {
            return callback(null, true);
          }
          // Allow file endpoints without Origin header ONLY if they have an auth token
          // This maintains security: unauthenticated requests still need Origin,
          // and authenticated requests are protected by JWT verification in the route handler
          if (isFileEndpoint && hasAuthToken(req)) {
            return callback(null, true);
          }
          // Only allow no-origin requests in development (for mobile apps, curl, etc.)
          if (process.env.NODE_ENV !== 'production') {
            return callback(null, true);
          }
          // In production, reject requests with no origin for better security
          return callback(new Error('CORS: Origin header required'));
        }

        // Check against allowed origins
        const originsToCheck = process.env.NODE_ENV === 'production'
          ? productionOrigins
          : allowedOrigins;

        if (originsToCheck.includes(origin)) {
          callback(null, true);
        } else {
          // For file endpoints with a token, allow any origin (token provides security)
          // This handles cases where images are loaded from different origins
          if (isFileEndpoint && hasAuthToken(req)) {
            return callback(null, true);
          }
          // In development only, allow localhost on any port for convenience
          if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost:')) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        }
      } catch (error) {
        // If there's an error in the origin callback, log it and reject the request
        console.error('Error in CORS origin callback:', error);
        callback(new Error('CORS: Error processing origin'));
      }
    },
    credentials: true,
    // Additional security headers
    optionsSuccessStatus: 200,
  })(req, res, next);
});

// Create parser middleware instances with size limits to prevent DoS attacks
const jsonParser = express.json({ limit: '10mb' }); // 10MB limit for JSON payloads
const urlencodedParser = express.urlencoded({ extended: true, limit: '10mb' }); // 10MB limit for form data

// Conditional body parsing - skip multipart/form-data (handled by multer)
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const contentType = req.headers['content-type'] || '';

  // Skip parsing for multipart/form-data - let multer handle it
  if (contentType.includes('multipart/form-data')) {
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
app.use('/api/feedback', feedbackRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/send', sendRoutes);
app.use('/api/profiles', profilesRoutes);
app.use('/api/collections', collectionsRoutes);
app.use('/api/external', externalRoutes);
app.use('/api/slack', slackRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/stripe-webhook', stripeWebhookRoutes);

// Serve uploaded files (avatars, attachments, etc.)
app.get('/api/uploads/:path(*)', (req: express.Request, res: express.Response) => {
  try {
    const filePath = req.params.path;
    const fullPath = path.join(process.env.UPLOAD_DIR || './uploads', filePath);

    // Security: prevent directory traversal
    const resolvedPath = path.resolve(fullPath);
    const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
    if (!resolvedPath.startsWith(uploadDir)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    // Set appropriate content type
    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

    // Stream the file
    const fileStream = fs.createReadStream(resolvedPath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

// Health check
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Handle Multer errors (file upload errors)
  if (err instanceof multer.MulterError) {
    console.error('Multer error:', err);

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        details: 'The file you are trying to upload exceeds the maximum size limit of 25MB. Please choose a smaller file.'
      });
    }

    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files',
        details: 'You can upload a maximum of 1000 files at once.'
      });
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Unexpected file field',
        details: 'The file field name is incorrect. Please use "attachments" for file uploads.'
      });
    }

    return res.status(400).json({
      error: 'File upload error',
      details: err.message || 'An error occurred while uploading the file.'
    });
  }

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

  // Handle CORS errors - return proper CORS response instead of 500
  if (err?.message && (err.message.includes('CORS') || err.message.includes('Not allowed by CORS'))) {
    // CORS errors should return 403 or appropriate status
    // Don't log as unhandled error since this is expected behavior
    return res.status(403).json({
      error: 'CORS policy violation',
      message: err.message
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
