import { db } from '../db/index.js';
import { connectors, dataSources } from '../db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { ConnectorFactory } from '@brain/connectors';
import { decrypt } from '@brain/shared';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'change-me-in-production-32-chars';

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  executionTime: number;
}

interface ParsedQuery {
  select: string[];
  from: string[];
  where?: Record<string, unknown>;
  limit?: number;
  orderBy?: { column: string; direction: 'asc' | 'desc' };
}

export class QueryExecutor {
  /**
   * Execute a SQL-like query across data sources
   */
  async executeQuery(
    sqlQuery: string,
    organizationId: string,
    dataSourceIds?: string[]
  ): Promise<QueryResult> {
    const startTime = Date.now();

    try {
      // Parse SQL query (simplified parser for MVP)
      const parsed = this.parseQuery(sqlQuery);

      // Find data sources
      const sources = await this.findDataSources(
        organizationId,
        parsed.from,
        dataSourceIds
      );

      if (sources.length === 0) {
        throw new Error('No data sources found for query');
      }

      // Execute query on each data source
      const results: unknown[][] = [];
      let columns: string[] = [];

      for (const source of sources) {
        const result = await this.executeOnDataSource(source, parsed);

        if (columns.length === 0) {
          columns = result.columns;
        }

        results.push(...result.rows);
      }

      // Apply LIMIT if specified
      let finalRows = results;
      if (parsed.limit && parsed.limit > 0) {
        finalRows = finalRows.slice(0, parsed.limit);
      }

      // Apply ORDER BY if specified
      if (parsed.orderBy) {
        const colIndex = columns.indexOf(parsed.orderBy.column);
        if (colIndex >= 0) {
          finalRows.sort((a, b) => {
            const aVal = a[colIndex];
            const bVal = b[colIndex];

            if (aVal === bVal) return 0;
            if (aVal === null || aVal === undefined) return 1;
            if (bVal === null || bVal === undefined) return -1;

            const comparison = aVal < bVal ? -1 : 1;
            return parsed.orderBy!.direction === 'asc' ? comparison : -comparison;
          });
        }
      }

      return {
        columns,
        rows: finalRows,
        rowCount: finalRows.length,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse SQL query (simplified for MVP)
   */
  private parseQuery(sql: string): ParsedQuery {
    // Simple regex-based parser for MVP
    // In production, use a proper SQL parser

    const normalized = sql.trim().replace(/\s+/g, ' ');
    const upperSql = normalized.toUpperCase();

    // Extract SELECT columns
    const selectMatch = normalized.match(/SELECT\s+(.+?)\s+FROM/i);
    if (!selectMatch) {
      throw new Error('Invalid SQL: SELECT clause required');
    }

    const selectCols = selectMatch[1]
      .split(',')
      .map(col => col.trim())
      .filter(Boolean);

    // Extract FROM tables
    const fromMatch = normalized.match(/FROM\s+([^\s]+(?:\s+[^\s]+)*?)(?:\s+WHERE|\s+ORDER|\s+LIMIT|$)/i);
    if (!fromMatch) {
      throw new Error('Invalid SQL: FROM clause required');
    }

    const fromTables = fromMatch[1]
      .split(',')
      .map(t => t.trim().replace(/["`]/g, ''))
      .filter(Boolean);

    // Extract WHERE conditions (simplified)
    const where: Record<string, unknown> = {};
    const whereMatch = normalized.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|$)/i);
    if (whereMatch) {
      // Parse simple equality conditions (column = value)
      const conditions = whereMatch[1].split(/\s+AND\s+/i);
      for (const condition of conditions) {
        const eqMatch = condition.match(/(\w+)\s*=\s*(.+)/i);
        if (eqMatch) {
          const key = eqMatch[1].trim();
          let value = eqMatch[2].trim().replace(/^['"]|['"]$/g, '');

          // Try to parse as number
          if (/^\d+$/.test(value)) {
            value = parseInt(value, 10);
          } else if (/^\d+\.\d+$/.test(value)) {
            value = parseFloat(value);
          }

          where[key] = value;
        }
      }
    }

    // Extract LIMIT
    const limitMatch = normalized.match(/LIMIT\s+(\d+)/i);
    const limit = limitMatch ? parseInt(limitMatch[1], 10) : undefined;

    // Extract ORDER BY
    const orderMatch = normalized.match(/ORDER\s+BY\s+(\w+)\s+(ASC|DESC)/i);
    const orderBy = orderMatch
      ? {
          column: orderMatch[1].trim(),
          direction: (orderMatch[2].toLowerCase() as 'asc' | 'desc'),
        }
      : undefined;

    return {
      select: selectCols,
      from: fromTables,
      where: Object.keys(where).length > 0 ? where : undefined,
      limit,
      orderBy,
    };
  }

  /**
   * Find data sources matching the query tables
   */
  private async findDataSources(
    organizationId: string,
    tableNames: string[],
    preferredDataSourceIds?: string[]
  ) {
    // Get all connectors for the organization
    const orgConnectors = await db.query.connectors.findMany({
      where: eq(connectors.organizationId, organizationId),
    });

    const sources: Array<{
      connector: typeof connectors.$inferSelect;
      dataSource: typeof dataSources.$inferSelect;
      tableName: string;
    }> = [];

    for (const connector of orgConnectors) {
      const connectorSources = await db.query.dataSources.findMany({
        where: eq(dataSources.connectorId, connector.id),
      });

      for (const source of connectorSources) {
        // Match by table name
        if (tableNames.includes(source.tableName)) {
          // If preferred data source IDs are specified, filter by them
          if (!preferredDataSourceIds || preferredDataSourceIds.includes(source.id)) {
            sources.push({
              connector,
              dataSource: source,
              tableName: source.tableName,
            });
          }
        }
      }
    }

    return sources;
  }

  /**
   * Execute query on a specific data source
   */
  private async executeOnDataSource(
    source: {
      connector: typeof connectors.$inferSelect;
      dataSource: typeof dataSources.$inferSelect;
      tableName: string;
    },
    parsed: ParsedQuery
  ): Promise<{ columns: string[]; rows: unknown[][] }> {
    // Decrypt connector config
    const config = source.connector.config as any;
    let decryptedConfig: Record<string, unknown>;

    if (config?.encrypted && config?.data) {
      const decryptedJson = await decrypt(config.data, ENCRYPTION_KEY);
      decryptedConfig = JSON.parse(decryptedJson);
    } else {
      decryptedConfig = config as Record<string, unknown>;
    }

    // Create connector instance
    const connectorInstance = ConnectorFactory.create(source.connector.type as any);

    // Extract data with filters
    const extractOptions = {
      limit: parsed.limit || 1000,
      filters: parsed.where,
    };

    const extractResult = await connectorInstance.extract(
      decryptedConfig,
      source.tableName,
      extractOptions
    );

    // Transform data
    const schema = source.dataSource.schema as any;
    // Schema can be a table schema directly or nested in tables array
    const tableSchema = schema?.tables?.[0] || schema;

    const transformed = await connectorInstance.transform(
      extractResult.data,
      tableSchema
    );

    // Map to columns requested in SELECT
    const allColumns = tableSchema?.columns?.map((col: any) => col.name) ||
                       Object.keys(transformed[0] || {});

    // If SELECT * or all columns, use all
    const selectedColumns = parsed.select.includes('*')
      ? allColumns
      : parsed.select.filter(col => allColumns.includes(col));

    const rows = transformed.map((row: any) =>
      selectedColumns.map(col => row[col] ?? null)
    );

    return {
      columns: selectedColumns,
      rows,
    };
  }
}
