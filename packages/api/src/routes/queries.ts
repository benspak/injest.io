import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { queries, connectors, dataSources } from '../db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import axios from 'axios';
import { QueryExecutor } from '../services/queryExecutor.js';

const executeQuerySchema = z.object({
  query: z.string().min(1),
  queryType: z.enum(['sql', 'nlq']).optional().default('sql'),
  dataSourceIds: z.array(z.string()).optional().default([]),
});

const queryExecutor = new QueryExecutor();

export async function queryRoutes(app: FastifyInstance) {
  // Execute query
  app.post('/queries', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const body = executeQuerySchema.parse(request.body);

    let result;
    const startTime = Date.now();

    try {
      if (body.queryType === 'nlq') {
        // Use ML service to translate natural language
        const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:3002';

        // Get available schemas
        const orgConnectors = await db.query.connectors.findMany({
          where: eq(connectors.organizationId, request.user.organizationId),
        });

        const schemas: Array<{ name: string; columns: string[] }> = [];

        for (const connector of orgConnectors) {
          const sources = await db.query.dataSources.findMany({
            where: eq(dataSources.connectorId, connector.id),
          });

          for (const source of sources) {
            const schema = source.schema as any;
            if (schema?.columns) {
              schemas.push({
                name: schema.name || source.tableName,
                columns: schema.columns.map((col: any) => col.name),
              });
            }
          }
        }

        const nlqResponse = await axios.post(`${mlServiceUrl}/nlq/translate`, {
          query: body.query,
          schemas,
        });

        const translated = nlqResponse.data.data;

        // Execute the translated SQL query
        if (translated.sql) {
          result = await queryExecutor.executeQuery(
            translated.sql,
            request.user.organizationId,
            body.dataSourceIds.length > 0 ? body.dataSourceIds : undefined
          );
        } else {
          throw new Error('No SQL translation returned from NLQ service');
        }
      } else {
        // Execute SQL query directly
        result = await queryExecutor.executeQuery(
          body.query,
          request.user.organizationId,
          body.dataSourceIds.length > 0 ? body.dataSourceIds : undefined
        );
      }

      // Save query to database
      const [savedQuery] = await db.insert(queries).values({
        organizationId: request.user.organizationId,
        userId: request.user.userId,
        query: body.query,
        queryType: body.queryType,
        dataSources: body.dataSourceIds,
        result: result as any,
        executionTime: result.executionTime,
      }).returning();

      return {
        success: true,
        data: {
          query: savedQuery,
          result,
        },
      };
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error ? error.message : 'Query execution failed',
      });
    }
  });

  // List queries
  app.get('/queries', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const orgQueries = await db.query.queries.findMany({
      where: eq(queries.organizationId, request.user.organizationId),
      orderBy: (queries, { desc }) => [desc(queries.createdAt)],
      limit: 50,
    });

    return {
      success: true,
      data: orgQueries,
    };
  });

  // Get query
  app.get('/queries/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    const query = await db.query.queries.findFirst({
      where: and(
        eq(queries.id, id),
        eq(queries.organizationId, request.user.organizationId)
      ),
    });

    if (!query) {
      return reply.code(404).send({ error: 'Query not found' });
    }

    return {
      success: true,
      data: query,
    };
  });
}
