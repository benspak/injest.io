import type { BaseEntity } from './index.js';

export interface DataSource extends BaseEntity {
  connectorId: string;
  organizationId: string;
  tableName: string;
  schema: Record<string, unknown>;
  rowCount: number;
  lastSyncAt: Date;
  syncStatus: 'syncing' | 'completed' | 'failed';
}

export interface Query extends BaseEntity {
  organizationId: string;
  userId: string;
  query: string; // SQL-like or natural language
  queryType: 'sql' | 'nlq'; // Natural Language Query
  dataSources: string[];
  result?: QueryResult;
  executionTime?: number;
  cached?: boolean;
}

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  executionTime: number;
}

export interface Insight extends BaseEntity {
  organizationId: string;
  type: 'anomaly' | 'trend' | 'forecast' | 'correlation';
  title: string;
  description: string;
  dataSourceIds: string[];
  severity: 'low' | 'medium' | 'high';
  metadata: Record<string, unknown>;
  acknowledgedAt?: Date;
}
