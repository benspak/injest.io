# Setup Guide

## Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL 14+ with pgvector extension
- Redis (for BullMQ job queue)
- OpenAI API key

## Database Setup

1. Install PostgreSQL and pgvector extension:

```bash
# macOS
brew install postgresql@14
brew install pgvector

# Ubuntu
sudo apt install postgresql-14 postgresql-14-pgvector
```

2. Create database and enable extension:

```bash
createdb brain_ai
psql brain_ai -c "CREATE EXTENSION vector;"
```

3. Generate and run migrations:

```bash
cd packages/api

# Generate migration from schema
pnpm db:generate

# Run migrations
pnpm db:migrate
```

## Redis Setup

```bash
# macOS
brew install redis
brew services start redis

# Ubuntu
sudo apt install redis-server
sudo systemctl start redis
```

## Environment Variables

### Backend (`packages/api/.env`)

Copy `packages/api/.env.example` to `packages/api/.env` and fill in:

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Random secret for JWT tokens
- `OPENAI_API_KEY` - Your OpenAI API key
- `REDIS_URL` - Redis connection (default: redis://localhost:6379)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - For Google OAuth (optional for MVP)

### Frontend (`packages/frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Installation

```bash
# Install all dependencies
pnpm install

# Run database migrations
cd packages/api
pnpm db:migrate
```

## Running

```bash
# Terminal 1: Start API server
cd packages/api
pnpm dev

# Terminal 2: Start frontend
cd packages/frontend
pnpm dev
```

Visit http://localhost:3000

## Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `packages/chrome-ext` directory

## Development Tips

- The auto-structuring pipeline runs in the background via BullMQ
- Embeddings are generated asynchronously after items are created
- Check Redis dashboard for job queue status
- Use `pnpm db:studio` in packages/api to view database with Drizzle Studio
