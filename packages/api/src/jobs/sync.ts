import { createSyncWorker } from './queue.js';
import { db } from '../db/index.js';
import { connectors, connectorSchemas, dataSources } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { ConnectorFactory } from '@brain/connectors';
import { ConnectorStatus, decrypt } from '@brain/shared';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'change-me-in-production-32-chars';

export function startSyncWorker() {
  const worker = createSyncWorker(async (jobData) => {
    const { connectorId, connectorType, config, organizationId } = jobData;

    try {
      // Get connector from DB
      const connector = await db.query.connectors.findFirst({
        where: eq(connectors.id, connectorId),
      });

      if (!connector) {
        throw new Error(`Connector ${connectorId} not found`);
      }

      // Update status to syncing
      await db.update(connectors)
        .set({ status: ConnectorStatus.SYNCING, lastSyncAt: new Date() })
        .where(eq(connectors.id, connectorId));

      // Decrypt config if encrypted
      let decryptedConfig: Record<string, unknown>;
      const config = connector.config as any;
      if (config?.encrypted && config?.data) {
        const decryptedJson = await decrypt(config.data, ENCRYPTION_KEY);
        decryptedConfig = JSON.parse(decryptedJson);
      } else {
        // Legacy unencrypted config
        decryptedConfig = config as Record<string, unknown>;
      }

      // Create connector instance
      const connectorInstance = ConnectorFactory.create(connectorType as any);

      // Discover schema if needed
      const existingSchema = await db.query.connectorSchemas.findFirst({
        where: eq(connectorSchemas.connectorId, connectorId),
      });

      let schema;
      if (!existingSchema) {
        schema = await connectorInstance.discoverSchema(decryptedConfig);
        schema.connectorId = connectorId;

        await db.insert(connectorSchemas).values({
          connectorId,
          schema: schema as any,
          lastDiscoveryAt: schema.lastDiscoveryAt,
        });
      } else {
        schema = existingSchema.schema as any;
      }

      // Sync each table
      for (const table of schema.tables) {
        const extractResult = await connectorInstance.extract(decryptedConfig, table.name, {
          limit: 10000, // Batch size
        });

        const transformed = await connectorInstance.transform(
          extractResult.data,
          table
        );

        // Update data source record
        const existingDataSource = await db.query.dataSources.findFirst({
          where: eq(dataSources.tableName, table.name),
        });

        if (existingDataSource) {
          await db.update(dataSources)
            .set({
              rowCount: extractResult.totalCount || transformed.length,
              lastSyncAt: new Date(),
              syncStatus: 'completed',
            })
            .where(eq(dataSources.id, existingDataSource.id));
        } else {
          await db.insert(dataSources).values({
            connectorId,
            organizationId,
            tableName: table.name,
            schema: table as any,
            rowCount: extractResult.totalCount || transformed.length,
            syncStatus: 'completed',
          });
        }
      }

      // Update connector status
      await db.update(connectors)
        .set({
          status: ConnectorStatus.CONNECTED,
          lastSyncAt: new Date(),
          lastSyncError: null,
        })
        .where(eq(connectors.id, connectorId));

    } catch (error) {
      // Update connector status to error
      await db.update(connectors)
        .set({
          status: ConnectorStatus.ERROR,
          lastSyncError: error instanceof Error ? error.message : 'Unknown error',
        })
        .where(eq(connectors.id, connectorId));

      throw error;
    }
  });

  worker.on('completed', (job) => {
    console.log(`Sync job ${job.id} completed for connector ${job.data.connectorId}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Sync job ${job?.id} failed:`, err);
  });

  return worker;
}
