import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { connectors, organizations } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { ConnectorType, ConnectorStatus, encrypt, decrypt } from '@brain/shared';
import { ConnectorFactory } from '@brain/connectors';
import { syncQueue } from '../jobs/queue.js';

const createConnectorSchema = z.object({
  type: z.nativeEnum(ConnectorType),
  name: z.string().min(1),
  config: z.record(z.unknown()),
  syncSchedule: z.string().optional(),
});

const updateConnectorSchema = z.object({
  name: z.string().min(1).optional(),
  config: z.record(z.unknown()).optional(),
  syncSchedule: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function connectorRoutes(app: FastifyInstance) {
  // List connectors
  app.get('/connectors', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const orgConnectors = await db.query.connectors.findMany({
      where: eq(connectors.organizationId, request.user.organizationId),
      orderBy: (connectors, { desc }) => [desc(connectors.createdAt)],
    });

    // Remove encrypted config details from response
    const connectorsResponse = orgConnectors.map(({ config: _, ...connector }) => ({
      ...connector,
      config: { encrypted: true }, // Don't expose encrypted data
    }));

    return {
      success: true,
      data: connectorsResponse,
    };
  });

  // Get connector
  app.get('/connectors/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    const connector = await db.query.connectors.findFirst({
      where: and(
        eq(connectors.id, id),
        eq(connectors.organizationId, request.user.organizationId)
      ),
    });

    if (!connector) {
      return reply.code(404).send({ error: 'Connector not found' });
    }

    // Return connector without exposing encrypted config
    const { config: _, ...connectorResponse } = connector;
    return {
      success: true,
      data: {
        ...connectorResponse,
        config: { encrypted: true }, // Don't expose encrypted data
      },
    };
  });

  // Create connector
  app.post('/connectors', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const body = createConnectorSchema.parse(request.body);

    // Check organization limits
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, request.user.organizationId),
    });

    if (!org) {
      return reply.code(404).send({ error: 'Organization not found' });
    }

    const existingConnectors = await db.query.connectors.findMany({
      where: eq(connectors.organizationId, request.user.organizationId),
    });

    if (existingConnectors.length >= org.maxConnectors) {
      return reply.code(403).send({
        error: `Organization limit reached. Maximum ${org.maxConnectors} connectors allowed.`,
      });
    }

    // Encrypt config before storing
    const encryptionKey = process.env.ENCRYPTION_KEY || 'change-me-in-production-32-chars';
    const configJson = JSON.stringify(body.config);
    const encryptedConfig = await encrypt(configJson, encryptionKey);

    const [connector] = await db.insert(connectors).values({
      organizationId: request.user.organizationId,
      type: body.type,
      name: body.name,
      config: { encrypted: true, data: encryptedConfig } as any,
      status: ConnectorStatus.PENDING,
      syncSchedule: body.syncSchedule,
    }).returning();

    // Return connector without encrypted config details
    const { config: _, ...connectorResponse } = connector;

    return {
      success: true,
      data: {
        ...connectorResponse,
        config: { encrypted: true }, // Don't expose encrypted data
      },
    };
  });

  // Update connector
  app.patch('/connectors/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };
    const body = updateConnectorSchema.parse(request.body);

    const connector = await db.query.connectors.findFirst({
      where: and(
        eq(connectors.id, id),
        eq(connectors.organizationId, request.user.organizationId)
      ),
    });

    if (!connector) {
      return reply.code(404).send({ error: 'Connector not found' });
    }

    const updateData: Partial<typeof connectors.$inferInsert> = {};
    if (body.name) updateData.name = body.name;
    if (body.config) {
      // Encrypt new config if provided
      const encryptionKey = process.env.ENCRYPTION_KEY || 'change-me-in-production-32-chars';
      const configJson = JSON.stringify(body.config);
      const encryptedConfig = await encrypt(configJson, encryptionKey);
      updateData.config = { encrypted: true, data: encryptedConfig } as any;
    }
    if (body.syncSchedule !== undefined) updateData.syncSchedule = body.syncSchedule;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const [updated] = await db.update(connectors)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(connectors.id, id))
      .returning();

    const { config: _, ...updatedResponse } = updated;
    return {
      success: true,
      data: {
        ...updatedResponse,
        config: { encrypted: true }, // Don't expose encrypted data
      },
    };
  });

  // Delete connector
  app.delete('/connectors/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    const connector = await db.query.connectors.findFirst({
      where: and(
        eq(connectors.id, id),
        eq(connectors.organizationId, request.user.organizationId)
      ),
    });

    if (!connector) {
      return reply.code(404).send({ error: 'Connector not found' });
    }

    await db.delete(connectors).where(eq(connectors.id, id));

    return { success: true };
  });

  // Test connector connection
  app.post('/connectors/:id/test', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    const connector = await db.query.connectors.findFirst({
      where: and(
        eq(connectors.id, id),
        eq(connectors.organizationId, request.user.organizationId)
      ),
    });

    if (!connector) {
      return reply.code(404).send({ error: 'Connector not found' });
    }

    try {
      // Decrypt config
      const encryptionKey = process.env.ENCRYPTION_KEY || 'change-me-in-production-32-chars';
      const config = connector.config as any;
      let decryptedConfig: Record<string, unknown>;

      if (config?.encrypted && config?.data) {
        const decryptedJson = await decrypt(config.data, encryptionKey);
        decryptedConfig = JSON.parse(decryptedJson);
      } else {
        decryptedConfig = config as Record<string, unknown>;
      }

      // Create connector instance and test authentication
      const connectorInstance = ConnectorFactory.create(connector.type as any);
      const isAuthenticated = await connectorInstance.authenticate(decryptedConfig);

      if (isAuthenticated) {
        // Update connector status to connected
        await db.update(connectors)
          .set({
            status: ConnectorStatus.CONNECTED,
            lastSyncError: null,
          })
          .where(eq(connectors.id, id));

        return {
          success: true,
          data: {
            connected: true,
            message: 'Connection test successful',
          },
        };
      } else {
        return reply.code(400).send({
          success: false,
          error: 'Connection test failed: Authentication unsuccessful',
        });
      }
    } catch (error) {
      // Update connector status to error
      await db.update(connectors)
        .set({
          status: ConnectorStatus.ERROR,
          lastSyncError: error instanceof Error ? error.message : 'Connection test failed',
        })
        .where(eq(connectors.id, id));

      return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      });
    }
  });

  // Trigger sync
  app.post('/connectors/:id/sync', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    const connector = await db.query.connectors.findFirst({
      where: and(
        eq(connectors.id, id),
        eq(connectors.organizationId, request.user.organizationId)
      ),
    });

    if (!connector) {
      return reply.code(404).send({ error: 'Connector not found' });
    }

    // Add sync job to queue
    await syncQueue.add('sync', {
      connectorId: connector.id,
      connectorType: connector.type,
      config: connector.config as Record<string, unknown>,
      organizationId: request.user.organizationId,
    });

    return {
      success: true,
      message: 'Sync job queued',
    };
  });
}
