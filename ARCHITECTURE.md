# Architecture Overview

## System Architecture

```
┌─────────────────┐
│   Chrome Ext    │ ──┐
│   Frontend      │ ──┼──> API (Express) ──> PostgreSQL (pgvector)
│   Email Webhook │ ──┘         │
└─────────────────┘              │
                                 ▼
                            BullMQ (Redis)
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
            Processing Queue        Indexing Queue
            (Auto-structure)        (Generate embeddings)
                    │                         │
                    └────────────┬────────────┘
                                 ▼
                           OpenAI API
```

## Data Flow

### Capture Flow
1. User captures content (web/form/extension/email)
2. Item created in PostgreSQL
3. Processing job queued (BullMQ)
4. Worker classifies, extracts tags, summarizes (OpenAI)
5. Indexing job queued
6. Worker generates embedding (OpenAI ada-002)
7. Embedding stored in PostgreSQL (pgvector)

### Search Flow
1. User queries via semantic search
2. Query embedded using OpenAI
3. Vector similarity search in PostgreSQL
4. Results ranked by cosine similarity
5. Context provided to user

### Generation Flow
1. User provides prompt + optional context items
2. Context items retrieved from database
3. Prompt + context sent to OpenAI GPT-4
4. Generated response returned
5. Interaction logged for learning

## Database Schema

### Core Tables

**users**
- id (uuid)
- email (unique)
- name, avatar
- googleId
- timestamps

**items**
- id (uuid)
- ownerId → users.id
- type (enum: note, link, file, email, task, chat)
- raw (original content)
- clean (summarized content)
- title
- tags (jsonb array)
- source (jsonb: app, url, metadata)
- embedding (vector[1536])
- embeddingId
- metadata (jsonb)
- isTask, taskCompleted
- timestamps

**interactions**
- id (uuid)
- userId, itemId
- type (query, capture, taskify, generate)
- query, response
- metadata (jsonb)
- timestamp

## API Endpoints

### Auth
- `POST /auth/google` - Google OAuth login
- `POST /auth/magic-link` - Request magic link
- `GET /auth/verify?token=...` - Verify magic link

### Items
- `POST /items` - Create item
- `GET /items` - List items (with filters)
- `POST /items/search` - Semantic search
- `POST /items/:id/taskify` - Convert to task
- `PATCH /items/:id/task` - Toggle task completion
- `POST /items/generate` - AI generation
- `DELETE /items/:id` - Delete item

### Email
- `POST /email/ingest` - Email webhook ingestion

## Background Jobs

### Processing Worker
- Classifies item type
- Extracts tags (max 5)
- Generates summary
- Sets title
- Queues indexing job

### Indexing Worker
- Generates embedding (OpenAI ada-002)
- Updates item with vector embedding
- Stores in pgvector for similarity search

## Security

- JWT-based authentication
- User-scoped data (ownerId filtering)
- Token validation middleware
- Secure password handling (future)

## Scalability Considerations

- Vector search optimized with pgvector indexes
- Background job processing (BullMQ)
- Stateless API design
- Embedding caching (future)
- Batch processing (future)
