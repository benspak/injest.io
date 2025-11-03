import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import type { Connector } from '@brain/shared';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export interface SyncJobData {
  connectorId: string;
  connectorType: string;
  config: Record<string, unknown>;
  organizationId: string;
}

export const syncQueue = new Queue<SyncJobData>('sync', {
  connection,
});

export function createSyncWorker(processJob: (job: SyncJobData) => Promise<void>) {
  return new Worker<SyncJobData>(
    'sync',
    async (job) => {
      await processJob(job.data);
    },
    {
      connection,
      concurrency: 5,
    }
  );
}
