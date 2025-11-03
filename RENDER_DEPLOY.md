# Deploying to Render.com

This guide explains how to deploy the Brain platform to Render.com.

## Prerequisites

1. A Render.com account
2. GitHub repository with your code pushed
3. API keys for external services (OpenAI, Anthropic, etc.) if needed

## Deployment Steps

### Option 1: Using render.yaml (Recommended)

1. Push your code to GitHub
2. In Render Dashboard, go to "New" → "Blueprint"
3. Connect your GitHub repository
4. Render will automatically detect `render.yaml` and create all services

### Option 2: Manual Setup

If you prefer manual setup or need to customize:

#### 1. Create PostgreSQL Database
- Type: PostgreSQL
- Name: `brain-database`
- Plan: Starter (free) or upgrade as needed
- Note the connection string

#### 2. Create Redis Instance
- Type: Redis
- Name: `brain-redis`
- Plan: Starter (free) or upgrade as needed
- Note the connection string

#### 3. Deploy API Service
- Type: Web Service
- Name: `brain-api`
- Environment: Node
- Root Directory: `packages/api`
- Build Command: `pnpm install --frozen-lockfile && cd ../.. && pnpm install --frozen-lockfile && cd packages/api && pnpm run build`
- Start Command: `npm start`
- Health Check Path: `/health`

**Environment Variables:**
- `NODE_ENV`: `production`
- `DATABASE_URL`: (from PostgreSQL service)
- `REDIS_URL`: (from Redis service)
- `API_HOST`: `0.0.0.0`
- `ML_SERVICE_URL`: (will be set after ML service is deployed)
- `NEXT_PUBLIC_API_URL`: (will be set after API service is deployed)
- `NEXT_PUBLIC_APP_URL`: (will be set after Frontend service is deployed)
- `ENCRYPTION_KEY`: Generate a secure 32+ character string
- `JWT_SECRET`: Generate a secure random string
- `OPENAI_API_KEY`: (optional, your OpenAI API key)
- `ANTHROPIC_API_KEY`: (optional, your Anthropic API key)

#### 4. Deploy ML Service
- Type: Web Service
- Name: `brain-ml-service`
- Environment: Node
- Root Directory: `packages/ml-service`
- Build Command: `pnpm install --frozen-lockfile && cd ../.. && pnpm install --frozen-lockfile && cd packages/ml-service && pnpm run build`
- Start Command: `npm start`
- Health Check Path: `/health`

**Environment Variables:**
- `NODE_ENV`: `production`
- `ML_HOST`: `0.0.0.0`
- `OPENAI_API_KEY`: (optional, your OpenAI API key)
- `ANTHROPIC_API_KEY`: (optional, your Anthropic API key)

#### 5. Deploy Frontend Service
- Type: Web Service
- Name: `brain-frontend`
- Environment: Node
- Root Directory: `packages/frontend`
- Build Command: `pnpm install --frozen-lockfile && cd ../.. && pnpm install --frozen-lockfile && cd packages/frontend && pnpm run build`
- Start Command: `npm start`

**Environment Variables:**
- `NODE_ENV`: `production`
- `NEXT_PUBLIC_API_URL`: (from API service URL)
- `NEXT_PUBLIC_APP_URL`: (from Frontend service URL)

## Service Dependencies

The services need to be created in this order:
1. PostgreSQL Database
2. Redis Instance
3. API Service (depends on Database and Redis)
4. ML Service
5. Frontend Service (depends on API Service)

## Post-Deployment

After all services are deployed:

1. **Update Service URLs**: Update the `ML_SERVICE_URL`, `NEXT_PUBLIC_API_URL`, and `NEXT_PUBLIC_APP_URL` environment variables in each service with the actual URLs.

2. **Run Migrations**: The API service will automatically run migrations on build, but you can also run them manually:
   ```bash
   cd packages/api
   npm run db:migrate
   ```

3. **Verify Health Checks**: Visit:
   - API: `https://your-api-url.onrender.com/health`
   - ML Service: `https://your-ml-url.onrender.com/health`
   - Frontend: `https://your-frontend-url.onrender.com`

## Troubleshooting

### Build Failures
- Ensure all environment variables are set
- Check that pnpm is being used (Render should detect this from `pnpm-lock.yaml`)
- Verify Node version (should use Node 20 based on `.nvmrc`)

### Database Connection Issues
- Verify `DATABASE_URL` is correctly set
- Check that PostgreSQL service is running
- Ensure database exists

### Redis Connection Issues
- Verify `REDIS_URL` is correctly set
- Check that Redis service is running

### Service Communication Issues
- Verify service URLs are correctly set in environment variables
- Check that health endpoints are responding
- Ensure CORS is properly configured

## Cost Considerations

Free tier limits:
- 750 hours/month per service
- Services spin down after 15 minutes of inactivity
- Upgrade plans available for 24/7 uptime

For production use, consider upgrading to paid plans for:
- 24/7 uptime (no spin-down)
- Better performance
- More resources

## Security Notes

- **Never commit** `.env` files or secrets to Git
- Use Render's environment variable management
- Generate strong `ENCRYPTION_KEY` and `JWT_SECRET` values
- Rotate secrets regularly in production
