import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from 'dotenv';
import { setupJWT } from './auth/jwt.js';
import { authRoutes } from './routes/auth.js';
import { connectorRoutes } from './routes/connectors.js';
import { queryRoutes } from './routes/queries.js';
import { startSyncWorker } from './jobs/sync.js';

config();

const app = Fastify({
  logger: true,
});

// CORS
await app.register(cors, {
  origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  credentials: true,
});

// JWT
await setupJWT(app);

// Routes
await app.register(authRoutes);
await app.register(connectorRoutes);
await app.register(queryRoutes);

// Health check
app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Start sync worker
startSyncWorker();

// Start server
// Render.com uses PORT env var, but we also support API_PORT for local dev
const PORT = Number(process.env.PORT) || Number(process.env.API_PORT) || 3001;
const HOST = process.env.API_HOST || '0.0.0.0';

app.listen({ port: PORT, host: HOST }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`Server listening at ${address}`);
});
