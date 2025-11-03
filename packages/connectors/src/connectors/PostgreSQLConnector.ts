import { Client } from 'pg';
import { BaseConnector } from '../base/BaseConnector.js';
import type {
  ConnectorSchema,
  ExtractOptions,
  ExtractResult,
  TableSchema,
} from '@brain/shared';

export class PostgreSQLConnector extends BaseConnector {
  type = 'postgresql';

  async authenticate(config: Record<string, unknown>): Promise<boolean> {
    this.validateConfig(config, ['host', 'port', 'database', 'user', 'password']);

    const client = new Client({
      host: config.host as string,
      port: config.port as number,
      database: config.database as string,
      user: config.user as string,
      password: config.password as string,
      ssl: config.ssl as boolean | undefined,
    });

    try {
      await client.connect();
      await client.end();
      return true;
    } catch (error) {
      throw new Error(`PostgreSQL authentication failed: ${error}`);
    }
  }

  async discoverSchema(config: Record<string, unknown>): Promise<ConnectorSchema> {
    this.validateConfig(config, ['host', 'port', 'database', 'user', 'password']);

    const client = new Client({
      host: config.host as string,
      port: config.port as number,
      database: config.database as string,
      user: config.user as string,
      password: config.password as string,
      ssl: config.ssl as boolean | undefined,
    });

    try {
      await client.connect();

      // Get all tables and views
      const tablesQuery = `
        SELECT
          t.table_name,
          t.table_type,
          COUNT(*) as row_count
        FROM information_schema.tables t
        LEFT JOIN information_schema.table_constraints tc
          ON t.table_schema = tc.table_schema
          AND t.table_name = tc.table_name
        WHERE t.table_schema = $1
        GROUP BY t.table_name, t.table_type
        ORDER BY t.table_name;
      `;

      const schema = config.schema as string || 'public';
      const tablesResult = await client.query(tablesQuery, [schema]);

      const tables: TableSchema[] = [];

      for (const table of tablesResult.rows) {
        // Get columns for each table
        const columnsQuery = `
          SELECT
            c.column_name,
            c.data_type,
            c.is_nullable,
            CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key
          FROM information_schema.columns c
          LEFT JOIN (
            SELECT ku.table_schema, ku.table_name, ku.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage ku
              ON tc.constraint_name = ku.constraint_name
            WHERE tc.constraint_type = 'PRIMARY KEY'
          ) pk ON c.table_schema = pk.table_schema
            AND c.table_name = pk.table_name
            AND c.column_name = pk.column_name
          WHERE c.table_schema = $1 AND c.table_name = $2
          ORDER BY c.ordinal_position;
        `;

        const columnsResult = await client.query(columnsQuery, [schema, table.table_name]);

        tables.push({
          name: table.table_name,
          type: table.table_type === 'VIEW' ? 'view' : 'table',
          columns: columnsResult.rows.map((col) => ({
            name: col.column_name,
            type: col.data_type,
            nullable: col.is_nullable === 'YES',
            primaryKey: col.is_primary_key,
          })),
          rowCount: parseInt(table.row_count, 10),
        });
      }

      await client.end();

      return {
        connectorId: '', // Will be set by caller
        tables,
        lastDiscoveryAt: new Date(),
      };
    } catch (error) {
      await client.end();
      throw new Error(`Schema discovery failed: ${error}`);
    }
  }

  async extract(
    config: Record<string, unknown>,
    tableName: string,
    options?: ExtractOptions
  ): Promise<ExtractResult> {
    this.validateConfig(config, ['host', 'port', 'database', 'user', 'password']);

    const client = new Client({
      host: config.host as string,
      port: config.port as number,
      database: config.database as string,
      user: config.user as string,
      password: config.password as string,
      ssl: config.ssl as boolean | undefined,
    });

    try {
      await client.connect();

      const schema = config.schema as string || 'public';
      const limit = options?.limit || 1000;
      const offset = options?.offset || 0;

      let query = `SELECT * FROM ${schema}.${tableName}`;
      const params: unknown[] = [];

      // Add WHERE clause for filters
      if (options?.filters && Object.keys(options.filters).length > 0) {
        const conditions: string[] = [];
        Object.entries(options.filters).forEach(([key, value], index) => {
          conditions.push(`${key} = $${params.length + 1}`);
          params.push(value);
        });
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      // Add ORDER BY for pagination
      if (options?.cursor) {
        // Assume cursor-based pagination with a timestamp or ID
        query += ` WHERE created_at > $${params.length + 1}`;
        params.push(options.cursor);
      }

      query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await client.query(query, params);

      // Check if there are more results
      const countQuery = `SELECT COUNT(*) as total FROM ${schema}.${tableName}`;
      const countResult = await client.query(countQuery);
      const total = parseInt(countResult.rows[0].total, 10);
      const hasMore = offset + limit < total;

      await client.end();

      return {
        data: result.rows,
        hasMore,
        totalCount: total,
      };
    } catch (error) {
      await client.end();
      throw new Error(`Data extraction failed: ${error}`);
    }
  }

  async scheduleSync(config: Record<string, unknown>, schedule: string): Promise<void> {
    // Schedule will be handled by the job queue system
    // This is just a placeholder
    return Promise.resolve();
  }
}
