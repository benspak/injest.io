# Injest.io - Knowledge Recall System

MVP for capturing, recalling, and acting on knowledge in under 3 steps.

## Architecture

Monorepo with three packages:
- `packages/api` - Express backend with Postgres + pgvector
- `packages/frontend` - Next.js app with ShadCN UI
- `packages/chrome-ext` - Browser extension for capture

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables:
- Copy `.env.example` files in each package
- Configure database, OpenAI, Resend, and OAuth credentials

3. Run database migrations:
```bash
pnpm db:migrate
```

4. Start development:
```bash
# Backend
pnpm dev:api

# Frontend
pnpm dev:frontend
```

## Development

### Day 1: "It Remembers"
- Universal capture (text, links, files)
- Semantic search with vector similarity
- Chrome extension for quick capture

### Day 2: "It Does Something With It"
- Auto-structuring and summarization
- Task view and AI generation
- Email ingestion via Resend
