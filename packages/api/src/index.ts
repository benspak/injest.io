import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { authRouter } from './routes/auth.js';
import { itemsRouter } from './routes/items.js';
import { emailRouter } from './routes/email.js';
import { indexingWorker, processingWorker } from './jobs/queue.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use(authRouter);
app.use(itemsRouter);
app.use(emailRouter);

// Start workers
console.log('Starting background workers...');
indexingWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});
indexingWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

processingWorker.on('completed', (job) => {
  console.log(`Processing job ${job.id} completed`);
});
processingWorker.on('failed', (job, err) => {
  console.error(`Processing job ${job?.id} failed:`, err);
});

app.listen(PORT, () => {
  console.log(`🚀 Brain AI API running on http://localhost:${PORT}`);
});
