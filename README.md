# Injest.io - Knowledge Recall MVP

A full-stack knowledge recall system with semantic search, auto-structuring, and browser extension capture.

## Architecture

- **`packages/api`** - Express backend with Postgres + pgvector, BullMQ, OpenAI
- **`packages/frontend`** - Next.js 14 app with ShadCN UI
- **`packages/chrome-ext`** - Chrome Extension for content capture

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ with pgvector extension
- Redis (for BullMQ)
- npm 9+

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Database setup:**
   - Install pgvector extension in PostgreSQL
   - Create a database for the project
   - See `SETUP.md` for detailed instructions

3. **Environment variables:**
   - Copy `.env.example` files in each package
   - Configure all required variables (see `SETUP.md`)

4. **Run migrations:**
   ```bash
   npm run db:migrate
   ```

5. **Start development servers:**
   ```bash
   # Backend (port 3001)
   npm run dev -w packages/api

   # Frontend (port 3000)
   npm run dev -w packages/frontend
   ```

6. **Load Chrome Extension:**
   - Open Chrome → Extensions → Developer mode
   - Load unpacked from `packages/chrome-ext`

## Features

- **Universal Capture**: Text, links, files
- **Semantic Search**: Vector-based similarity search
- **Auto-Structuring**: AI-powered tagging and categorization
- **Task Management**: Convert items to actionable tasks
- **AI Generation**: Context-aware drafts and summaries
- **Email Ingestion**: Forward emails to capture inbox

## Documentation

See `SETUP.md` for detailed environment setup and deployment instructions.
