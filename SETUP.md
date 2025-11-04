# Setup Guide

## Environment Variables

### Backend (`packages/api/.env`)

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/injest_dev

# OpenAI
OPENAI_API_KEY=sk-...

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Email (Resend)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Redis (BullMQ)
REDIS_URL=redis://localhost:6379

# URLs
FRONTEND_URL=http://localhost:3000
API_URL=http://localhost:3001

# File Upload (development)
UPLOAD_DIR=./uploads

# Node Environment
NODE_ENV=development
PORT=3001
```

### Frontend (`packages/frontend/.env.local`)

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Database Setup

### Local PostgreSQL with pgvector

**macOS (Homebrew):**
```bash
brew install postgresql@14
brew install pgvector
```

**Ubuntu/Debian:**
```bash
sudo apt install postgresql-14 postgresql-14-pgvector
```

**Create database:**
```bash
createdb injest_dev
psql injest_dev -c "CREATE EXTENSION vector;"
```

**Verify pgvector:**
```bash
psql injest_dev -c "SELECT * FROM pg_extension WHERE extname = 'vector';"
```

### Render.com Postgres

1. Create Postgres database in Render dashboard
2. Connect via psql:
   ```bash
   psql $DATABASE_URL
   ```
3. Enable pgvector:
   ```sql
   CREATE EXTENSION vector;
   ```

## Redis Setup

**macOS:**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt install redis-server
sudo systemctl start redis
```

**Verify:**
```bash
redis-cli ping
# Should return: PONG
```

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3001/auth/google/callback`
5. Copy Client ID and Client Secret

## Resend Setup

1. Sign up at [Resend](https://resend.com/)
2. Verify your domain (for production)
3. Create API key in dashboard
4. Configure inbound email:
   - Add domain in Resend dashboard
   - Set webhook URL: `https://your-api.com/api/email/inbound`

## Running Migrations

```bash
# Generate migration
npm run db:generate -w packages/api

# Run migrations
npm run db:migrate -w packages/api
```

## Development Workflow

1. **Terminal 1 - Backend:**
   ```bash
   cd packages/api
   npm run dev
   ```

2. **Terminal 2 - Frontend:**
   ```bash
   cd packages/frontend
   npm run dev
   ```

3. **Terminal 3 - Worker (optional, for background jobs):**
   ```bash
   cd packages/api
   npm run worker
   ```

## Chrome Extension Development

1. Make changes to extension files
2. In Chrome: Extensions → Developer mode → Reload extension
3. Test on any webpage

## Deployment (Render.com)

See `render.yaml` for blueprint configuration.

**Steps:**
1. Push code to GitHub
2. Connect repository to Render
3. Create new Blueprint from `render.yaml`
4. Set all environment variables
5. Deploy

**Post-deployment:**
```bash
# Run migrations on production
npm run db:migrate -w packages/api
```
