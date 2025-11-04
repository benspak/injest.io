# Setup Guide

## Prerequisites

- Node.js 18+ and pnpm
- PostgreSQL 14+ with pgvector extension
- Redis (for BullMQ job queue)
- OpenAI API key
- Resend API key (for email)
- Google OAuth credentials (optional, for OAuth login)

## Installation

1. Install dependencies:
```bash
pnpm install
```

2. Set up PostgreSQL with pgvector:

**On macOS (Homebrew):**
```bash
# First, try installing pgvector directly
brew install pgvector

# If that doesn't work or you have a specific PostgreSQL version,
# you'll need to build from source (see below)
```

**Install from source (recommended for PostgreSQL 15 via Homebrew):**
```bash
# Clone pgvector repository
cd /tmp
git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git
cd pgvector

# Build with your PostgreSQL version (Homebrew PostgreSQL 15)
# Set PG_CONFIG to point to your PostgreSQL installation
export PG_CONFIG=/opt/homebrew/opt/postgresql@15/bin/pg_config

# Build and install
make
make install # may need sudo

# Verify installation - check if files are in the right place
ls $(pg_config --sharedir)/extension/vector*

# Create database if not exists
createdb injest

# Enable extension
psql injest -c "CREATE EXTENSION vector;"
```

**Troubleshooting:**
- If you get "extension not available" error, make sure pgvector is installed in the same location as your PostgreSQL installation
- Check PostgreSQL version: `psql --version`
- Find PostgreSQL share directory: `pg_config --sharedir`
- Ensure pgvector files are in: `$(pg_config --sharedir)/extension/`

3. Set up environment variables:

### Backend (`packages/api/.env`):
```env
DATABASE_URL=postgresql://user:password@localhost:5432/injest
JWT_SECRET=your-secret-key-change-in-production
SESSION_SECRET=your-session-secret-change-in-production
OPENAI_API_KEY=sk-...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=onboarding@resend.dev
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FRONTEND_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379
PORT=3001
```

### Frontend (`packages/frontend/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

4. Run database migrations:
```bash
cd packages/api
pnpm db:generate  # Generate migration from schema
pnpm db:migrate   # Run migrations
```

5. Start Redis:
```bash
redis-server
```

6. Start development servers:
```bash
# Terminal 1 - Backend
pnpm dev:api

# Terminal 2 - Frontend
pnpm dev:frontend
```

## Chrome Extension Setup

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `packages/chrome-ext` directory
5. Create icon files (or use placeholders):
   - `packages/chrome-ext/icons/icon16.png`
   - `packages/chrome-ext/icons/icon48.png`
   - `packages/chrome-ext/icons/icon128.png`

## Email Setup (Resend)

1. Sign up at https://resend.com
2. Get your API key
3. Set up inbound webhook:
   - Go to Resend dashboard → Webhooks
   - Add webhook: `http://your-api-url/api/email/inbound`
   - Forward emails to your Resend domain

## Usage

1. Sign up via magic link or Google OAuth
2. Capture items via:
   - Web dashboard
   - Chrome extension (highlight text → Save)
   - Email forwarding
3. Search with Cmd+K (or Ctrl+K)
4. Convert items to tasks
5. Generate AI responses based on your knowledge
