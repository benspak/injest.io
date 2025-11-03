# Deployment Guide for Render.com

This guide covers deploying Brain AI MVP to Render.com.

## Prerequisites

1. Render.com account
2. GitHub/GitLab/Bitbucket repository with your code
3. OpenAI API key

## Quick Deploy

### Option 1: Using render.yaml (Recommended)

1. Push your code to GitHub/GitLab/Bitbucket
2. In Render Dashboard, click "New" → "Blueprint"
3. Connect your repository
4. Render will automatically detect `render.yaml` and create all services

### Option 2: Manual Setup

Create services manually in Render Dashboard:

#### 1. PostgreSQL Database

- **Name**: `brain-ai-db`
- **Database**: `brain_ai`
- **User**: `brain_ai`
- **Plan**: Starter (or higher for production)

**Important**: After database creation, enable pgvector extension:

1. Go to database → "Connect" → "External Connection"
2. Connect via psql or use Render Shell:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

Or use the API service postdeploy script (runs automatically on first deploy).

#### 2. Redis Instance

- **Name**: `brain-ai-redis`
- **Plan**: Starter (or higher for production)

#### 3. Backend API Service

- **Type**: Web Service
- **Name**: `brain-ai-api`
- **Environment**: Node
- **Root Directory**: `packages/api`
- **Build Command**: `pnpm install && pnpm build`
- **Start Command**: `pnpm postdeploy && pnpm db:migrate && pnpm start`
- **Plan**: Starter (or higher)

**Environment Variables**:
- `NODE_ENV`: `production`
- `PORT`: `10000` (Render sets this automatically, but we specify for clarity)
- `DATABASE_URL`: From database `brain-ai-db` → Connection String
- `REDIS_URL`: From Redis `brain-ai-redis` → Connection String
- `JWT_SECRET`: Generate random secret (use Render's "Generate Value")
- `OPENAI_API_KEY`: Your OpenAI API key
- `BASE_URL`: From frontend service → Host (auto-populated)

#### 4. Frontend Service

- **Type**: Web Service
- **Name**: `brain-ai-frontend`
- **Environment**: Node
- **Root Directory**: `packages/frontend`
- **Build Command**: `pnpm install && pnpm build`
- **Start Command**: `pnpm start`
- **Plan**: Starter (or higher)

**Environment Variables**:
- `NODE_ENV`: `production`
- `NEXT_PUBLIC_API_URL`: From API service → Host URL (e.g., `https://brain-ai-api.onrender.com`)

#### 5. Background Workers Service

- **Type**: Background Worker
- **Name**: `brain-ai-workers`
- **Environment**: Node
- **Root Directory**: `packages/api`
- **Build Command**: `pnpm install && pnpm build`
- **Start Command**: `node dist/jobs/worker.js`
- **Plan**: Starter (or higher)

**Environment Variables**:
- `NODE_ENV`: `production`
- `DATABASE_URL`: From database `brain-ai-db` → Connection String
- `REDIS_URL`: From Redis `brain-ai-redis` → Connection String
- `OPENAI_API_KEY`: Your OpenAI API key

## Post-Deployment Steps

### 1. Enable pgvector Extension

The postdeploy script runs automatically on first API deployment, but you can verify:

```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

If not enabled, run manually via Render Shell or external connection:

```sql
CREATE EXTENSION vector;
```

### 2. Run Initial Migrations

Migrations run automatically via the start command. Verify by checking:

- API service logs for "Migrations complete!"
- Database tables exist (`users`, `items`, `interactions`)

### 3. Update Chrome Extension

Update Chrome extension `popup.js` with your production API URL:

```javascript
const API_URL = 'https://your-api-url.onrender.com';
```

### 4. Configure CORS (if needed)

The API already has CORS enabled, but verify in `packages/api/src/index.ts` that it allows your frontend domain.

## Environment Variables Summary

### Required for All Services
- `NODE_ENV`: `production`

### API Service
- `DATABASE_URL` (from database)
- `REDIS_URL` (from Redis)
- `JWT_SECRET` (generate random)
- `OPENAI_API_KEY` (your key)
- `BASE_URL` (from frontend service)

### Frontend Service
- `NEXT_PUBLIC_API_URL` (from API service)

### Worker Service
- `DATABASE_URL` (from database)
- `REDIS_URL` (from Redis)
- `OPENAI_API_KEY` (your key)

## Monitoring

### Health Checks

- **API**: `https://your-api-url.onrender.com/health`
- **Frontend**: Automatic Next.js health check

### Logs

Monitor logs in Render Dashboard:
- API service logs
- Worker service logs
- Database connection issues
- Job processing errors

### Common Issues

1. **pgvector not enabled**
   - Run: `CREATE EXTENSION vector;` in database

2. **Migrations failing**
   - Check DATABASE_URL is correct
   - Verify database user has permissions

3. **Workers not processing jobs**
   - Verify REDIS_URL is correct
   - Check worker service logs
   - Ensure worker service is running

4. **CORS errors**
   - Verify BASE_URL matches frontend URL
   - Check API service CORS configuration

## Scaling

### For Production

1. **Database**: Upgrade to higher plan (e.g., Standard)
2. **Redis**: Upgrade for better performance
3. **API**: Use multiple instances (higher plan)
4. **Workers**: Scale horizontally as needed

### Cost Estimates (Starter Plans)

- PostgreSQL: $7/month
- Redis: $10/month
- API Service: $7/month
- Frontend Service: $7/month
- Worker Service: $7/month
- **Total**: ~$38/month

Upgrade to Standard plans for production: ~$100-200/month.

## Security Checklist

- ✅ JWT_SECRET is strong and randomly generated
- ✅ OPENAI_API_KEY is secure (not exposed in logs)
- ✅ Database connection uses SSL
- ✅ CORS is properly configured
- ✅ Environment variables are not in code
- ✅ Health checks are configured

## Updating Deployments

When you push changes:

1. Render automatically rebuilds services
2. Migrations run on API service startup
3. Workers restart with new code
4. Zero-downtime deployments (for Standard plans)

## Troubleshooting

### API won't start
- Check build logs for TypeScript errors
- Verify all environment variables are set
- Check database connectivity

### Workers not processing
- Verify worker service is running
- Check Redis connectivity
- Review worker logs for errors

### Frontend build fails
- Check Next.js build logs
- Verify `NEXT_PUBLIC_API_URL` is set
- Check for missing dependencies

## Support

For Render-specific issues, consult:
- [Render Documentation](https://render.com/docs)
- [Render Status Page](https://status.render.com)

For application issues, check:
- API service logs
- Worker service logs
- Database query logs (if enabled)
