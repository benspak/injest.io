import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from 'dotenv';
import { NLQService } from './services/nlq.js';

config();

const app = Fastify({
  logger: true,
});

const nlqService = new NLQService();

await app.register(cors, {
  origin: true,
  credentials: true,
});

// Translate natural language to SQL
app.post('/nlq/translate', async (request, reply) => {
  const body = request.body as {
    query: string;
    schemas: Array<{ name: string; columns: string[] }>;
  };

  if (!body.query || !body.schemas) {
    return reply.code(400).send({ error: 'Missing query or schemas' });
  }

  try {
    const result = await nlqService.translateQuery(body.query, body.schemas);
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return reply.code(500).send({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Generate insights from data
app.post('/insights/generate', async (request, reply) => {
  const body = request.body as {
    data: unknown[];
  };

  if (!body.data || !Array.isArray(body.data)) {
    return reply.code(400).send({ error: 'Missing or invalid data' });
  }

  try {
    const insights = await nlqService.generateInsights(body.data);
    return {
      success: true,
      data: insights,
    };
  } catch (error) {
    return reply.code(500).send({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Health check
app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Render.com uses PORT env var, but we also support ML_PORT for local dev
const PORT = Number(process.env.PORT) || Number(process.env.ML_PORT) || 3002;
const HOST = process.env.ML_HOST || '0.0.0.0';

app.listen({ port: PORT, host: HOST }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`ML Service listening at ${address}`);
});
