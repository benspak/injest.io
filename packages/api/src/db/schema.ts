import { pgTable, uuid, text, timestamp, jsonb, pgEnum, boolean } from 'drizzle-orm/pg-core';
import { vector } from 'pgvector/drizzle-orm';

export const itemTypeEnum = pgEnum('item_type', [
  'note',
  'link',
  'file',
  'email',
  'task',
  'chat'
]);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatar: text('avatar'),
  googleId: text('google_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const items = pgTable('items', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: itemTypeEnum('type').notNull(),
  raw: text('raw').notNull(), // Original content
  clean: text('clean'), // Summarized/cleaned content
  title: text('title'),
  tags: jsonb('tags').$type<string[]>().default([]),
  source: jsonb('source').$type<{
    app?: string;
    url?: string;
    metadata?: Record<string, unknown>;
  }>(),
  embeddingId: text('embedding_id'),
  embedding: vector('embedding', { dimensions: 1536 }), // OpenAI ada-002
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  isTask: boolean('is_task').default(false),
  taskCompleted: boolean('task_completed').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const interactions = pgTable('interactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  itemId: uuid('item_id').references(() => items.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'query', 'capture', 'taskify', 'generate'
  query: text('query'),
  response: text('response'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
