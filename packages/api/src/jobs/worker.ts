/**
 * Standalone worker process for background job processing
 * Runs separately from the API server for better scalability
 */
import 'dotenv/config';
import { indexingWorker, processingWorker } from './queue.js';

console.log('🚀 Starting Brain AI background workers...');

// Event handlers for monitoring
indexingWorker.on('completed', (job) => {
  console.log(`✅ Indexing job ${job.id} completed`);
});

indexingWorker.on('failed', (job, err) => {
  console.error(`❌ Indexing job ${job?.id} failed:`, err);
});

processingWorker.on('completed', (job) => {
  console.log(`✅ Processing job ${job.id} completed`);
});

processingWorker.on('failed', (job, err) => {
  console.error(`❌ Processing job ${job?.id} failed:`, err);
});

// Keep process alive
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down workers...');
  await indexingWorker.close();
  await processingWorker.close();
  process.exit(0);
});

console.log('✅ Workers started and ready to process jobs');
