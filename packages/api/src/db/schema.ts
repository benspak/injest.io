import { pgTable, text, timestamp, boolean, jsonb, varchar, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'user', 'viewer']);
export const connectorTypeEnum = pgEnum('connector_type', [
  'postgresql',
  'mysql',
  'rest_api',
  'google_analytics',
  'salesforce',
  'hubspot',
  's3',
  'gcs',
  'mixpanel',
]);
export const connectorStatusEnum = pgEnum('connector_status', [
  'pending',
  'connected',
  'syncing',
  'error',
  'disconnected',
]);
export const syncStatusEnum = pgEnum('sync_status', ['syncing', 'completed', 'failed']);
export const planEnum = pgEnum('plan', ['free', 'pro', 'enterprise']);
export const insightTypeEnum = pgEnum('insight_type', ['anomaly', 'trend', 'forecast', 'correlation']);
export const insightSeverityEnum = pgEnum('insight_severity', ['low', 'medium', 'high']);

// Organizations
export const organizations = pgTable('organizations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  plan: planEnum('plan').notNull().default('free'),
  maxConnectors: integer('max_connectors').notNull().default(3),
  maxDataVolume: integer('max_data_volume').notNull().default(1000000), // bytes
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Users
export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  passwordHash: text('password_hash'),
  role: userRoleEnum('role').notNull().default('user'),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  avatarUrl: text('avatar_url'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// API Keys
export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  keyHash: text('key_hash').notNull(),
  keyPrefix: varchar('key_prefix', { length: 8 }).notNull(),
  expiresAt: timestamp('expires_at'),
  lastUsedAt: timestamp('last_used_at'),
  permissions: jsonb('permissions').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Connectors
export const connectors = pgTable('connectors', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  type: connectorTypeEnum('type').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  status: connectorStatusEnum('status').notNull().default('pending'),
  config: jsonb('config').notNull(), // Encrypted config
  lastSyncAt: timestamp('last_sync_at'),
  lastSyncError: text('last_sync_error'),
  syncSchedule: varchar('sync_schedule', { length: 100 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Connector Schemas
export const connectorSchemas = pgTable('connector_schemas', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  connectorId: text('connector_id').notNull().references(() => connectors.id, { onDelete: 'cascade' }),
  schema: jsonb('schema').notNull().$type<{
    tables: Array<{
      name: string;
      type: 'table' | 'view' | 'collection';
      columns: Array<{
        name: string;
        type: string;
        nullable: boolean;
        primaryKey?: boolean;
        description?: string;
      }>;
      rowCount?: number;
      lastUpdated?: Date;
    }>;
  }>(),
  lastDiscoveryAt: timestamp('last_discovery_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Data Sources
export const dataSources = pgTable('data_sources', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  connectorId: text('connector_id').notNull().references(() => connectors.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  tableName: varchar('table_name', { length: 255 }).notNull(),
  schema: jsonb('schema').notNull(),
  rowCount: integer('row_count').notNull().default(0),
  lastSyncAt: timestamp('last_sync_at').notNull().defaultNow(),
  syncStatus: syncStatusEnum('sync_status').notNull().default('completed'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Queries
export const queries = pgTable('queries', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  query: text('query').notNull(),
  queryType: varchar('query_type', { length: 20 }).notNull().default('sql'),
  dataSources: jsonb('data_sources').$type<string[]>().notNull().default([]),
  result: jsonb('result').$type<{
    columns: string[];
    rows: unknown[][];
    rowCount: number;
    executionTime: number;
  }>(),
  executionTime: integer('execution_time'),
  cached: boolean('cached').default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Insights
export const insights = pgTable('insights', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  type: insightTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  dataSourceIds: jsonb('data_source_ids').$type<string[]>().notNull().default([]),
  severity: insightSeverityEnum('severity').notNull().default('medium'),
  metadata: jsonb('metadata').notNull().default({}),
  acknowledgedAt: timestamp('acknowledged_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  apiKeys: many(apiKeys),
  queries: many(queries),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  connectors: many(connectors),
  dataSources: many(dataSources),
  queries: many(queries),
  insights: many(insights),
}));

export const connectorsRelations = relations(connectors, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [connectors.organizationId],
    references: [organizations.id],
  }),
  schema: one(connectorSchemas),
  dataSources: many(dataSources),
}));
