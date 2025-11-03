import type { BaseEntity } from './index.js';

export enum ConnectorType {
  POSTGRESQL = 'postgresql',
  MYSQL = 'mysql',
  REST_API = 'rest_api',
  GOOGLE_ANALYTICS = 'google_analytics',
  SALESFORCE = 'salesforce',
  HUBSPOT = 'hubspot',
  S3 = 's3',
  GCS = 'gcs',
  MIXPANEL = 'mixpanel',
}

export enum ConnectorStatus {
  PENDING = 'pending',
  CONNECTED = 'connected',
  SYNCING = 'syncing',
  ERROR = 'error',
  DISCONNECTED = 'disconnected',
}

export interface Connector extends BaseEntity {
  organizationId: string;
  type: ConnectorType;
  name: string;
  status: ConnectorStatus;
  config: Record<string, unknown>; // Encrypted connector-specific config
  lastSyncAt?: Date;
  lastSyncError?: string;
  syncSchedule?: string; // Cron expression
  isActive: boolean;
}

export interface ConnectorSchema {
  connectorId: string;
  tables: TableSchema[];
  lastDiscoveryAt: Date;
}

export interface TableSchema {
  name: string;
  type: 'table' | 'view' | 'collection';
  columns: ColumnSchema[];
  rowCount?: number;
  lastUpdated?: Date;
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey?: boolean;
  description?: string;
}

// Connector interface that all connectors must implement
export interface IConnector {
  authenticate(config: Record<string, unknown>): Promise<boolean>;
  discoverSchema(config: Record<string, unknown>): Promise<ConnectorSchema>;
  extract(
    config: Record<string, unknown>,
    tableName: string,
    options?: ExtractOptions
  ): Promise<ExtractResult>;
  transform(data: unknown[], schema: TableSchema): Promise<TransformedData[]>;
  scheduleSync(config: Record<string, unknown>, schedule: string): Promise<void>;
}

export interface ExtractOptions {
  limit?: number;
  offset?: number;
  cursor?: string;
  filters?: Record<string, unknown>;
  since?: Date;
}

export interface ExtractResult {
  data: unknown[];
  nextCursor?: string;
  hasMore: boolean;
  totalCount?: number;
}

export interface TransformedData {
  [key: string]: unknown;
}
