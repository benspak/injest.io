import { pgTable, uuid, text, jsonb, timestamp, boolean, pgEnum, customType } from 'drizzle-orm/pg-core';

// Define vector type for pgvector
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(3072)';
  },
  toDriver(value: number[]): string {
    // Convert array to PostgreSQL vector format: [1,2,3]
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string | number[]): number[] {
    // Handle both string and array formats from database
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      // Remove brackets and parse
      const cleaned = value.replace(/[\[\]]/g, '');
      return cleaned.split(',').map(Number);
    }
    return [];
  },
});

export const itemTypeEnum = pgEnum('item_type', ['note', 'link', 'file', 'email']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  googleId: text('google_id').unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const items = pgTable('items', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerId: uuid('owner_id').references(() => users.id).notNull(),
  type: itemTypeEnum('type').notNull(),
  raw: text('raw').notNull(),
  clean: text('clean'),
  tags: text('tags').array(),
  source: jsonb('source'),
  embeddingId: uuid('embedding_id').references(() => embeddings.id),
  isTask: boolean('is_task').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const embeddings = pgTable('embeddings', {
  id: uuid('id').defaultRandom().primaryKey(),
  itemId: uuid('item_id').references(() => items.id).notNull(),
  embedding: vector('embedding', { dimensions: 3072 }), // text-embedding-3-large dimensions
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
