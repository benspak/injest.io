# Brain AI MVP - $10B Startup from First Principles

> **Goal**: Make people think less and ship more.

## 🎯 Core Loop

1. **Capture** – user throws anything at it (text, link, file, note)
2. **Normalize + index** – structure it into a personal knowledge graph
3. **Recall in context** – answer queries with source context
4. **Act** – allow the user to turn insights into action (draft, summarize, reply, task)

## 📦 Project Structure

```
packages/
  ├── api/          # Express backend (auth, ingestion, vector indexing)
  ├── frontend/     # Next.js + ShadCN UI
  └── chrome-ext/   # Chrome extension for capture
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL 14+ with pgvector extension
- Redis (for job queue)
- OpenAI API key

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Setup database (see SETUP.md for details)
createdb brain_ai
psql brain_ai -c "CREATE EXTENSION vector;"

# 3. Configure environment variables
# Copy .env.example to packages/api/.env
# Copy .env.example to packages/frontend/.env.local

# 4. Run migrations
cd packages/api
pnpm db:migrate

# 5. Start services
# Terminal 1: API
cd packages/api && pnpm dev

# Terminal 2: Frontend
cd packages/frontend && pnpm dev
```

Visit http://localhost:3000

## ✨ Features

### MVP Complete ✅

- ✅ Universal Capture (web, extension)
- ✅ Semantic Search with vector embeddings
- ✅ Auto-Structuring Pipeline (classification, tagging, summarization)
- ✅ Taskify (1-click conversion to tasks)
- ✅ Contextual AI Generation (drafts, summaries, replies)
- ✅ Auth (Google OAuth + Magic Link)
- ✅ Chrome Extension
- ✅ Email ingestion route

## 🛠 Tech Stack

- **Backend**: Node.js/Express, PostgreSQL with pgvector, BullMQ (Redis)
- **Frontend**: Next.js 14, ShadCN UI, Tailwind CSS
- **Auth**: JWT-based (Google OAuth + Magic Link)
- **AI**: OpenAI (embeddings: ada-002, generation: gpt-4-turbo)
- **Vector DB**: pgvector (PostgreSQL extension)

## 📚 Documentation

- [Setup Guide](./SETUP.md) - Detailed setup instructions
- [Chrome Extension](./packages/chrome-ext/README.md) - Extension usage

## 🎯 Distribution Strategy (Future)

1. Chrome Extension – "Save to Brain" + referral system
2. Inbox Ingestion – viral via email forwards
3. Slack/Discord Bot – "/askbrain" commands
4. Mobile Share Sheet – "Save to Brain" habit formation

## 💡 MVP Focus

**Included:**
- Personal knowledge graph
- Semantic search
- AI-powered generation
- Task management
- Multi-device sync

**Excluded (intentionally):**
- Teams/collaboration
- Billing
- Templates
- Complex sharing
- Permissions system

Focus: **Capture → Recall → Action** loop that feels like magic.

## 🔧 Development

```bash
# Run all services
pnpm dev

# Build all packages
pnpm build

# Database studio (Drizzle)
cd packages/api && pnpm db:studio
```

## 📝 Environment Variables

See `SETUP.md` for detailed environment variable configuration.

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key
- `JWT_SECRET` - Secret for JWT tokens
- `REDIS_URL` - Redis connection string
