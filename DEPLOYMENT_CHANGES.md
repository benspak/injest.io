# Render.com Deployment Changes

This document summarizes all changes made to enable deployment on Render.com.

## Files Created

1. **`render.yaml`** - Render.com blueprint configuration for all services
2. **`.nvmrc`** - Node.js version specification (Node 20)
3. **`.npmrc`** - npm/pnpm configuration for monorepo builds
4. **`RENDER_DEPLOY.md`** - Comprehensive deployment guide
5. **Build scripts** (optional, not needed with render.yaml):
   - `packages/api/render-build.sh`
   - `packages/frontend/render-build.sh`
   - `packages/ml-service/render-build.sh`

## Files Modified

### 1. `packages/api/src/index.ts`
- **Change**: Updated to support Render's `PORT` environment variable
- **Before**: `const PORT = Number(process.env.API_PORT) || 3001;`
- **After**: `const PORT = Number(process.env.PORT) || Number(process.env.API_PORT) || 3001;`
- **Reason**: Render.com uses the `PORT` env var, but we maintain backward compatibility

### 2. `packages/ml-service/src/index.ts`
- **Change**: Updated to support Render's `PORT` environment variable
- **Before**: `const PORT = Number(process.env.ML_PORT) || 3002;`
- **After**: `const PORT = Number(process.env.PORT) || Number(process.env.ML_PORT) || 3002;`
- **Reason**: Same as above

### 3. `packages/api/package.json`
- **Change**: Added postbuild script to run migrations
- **Added**: `"postbuild": "npm run db:migrate || echo 'Migrations skipped or already applied'"`
- **Reason**: Automatically run database migrations after build

### 4. `packages/api/src/db/migrate.ts`
- **Change**: Made migration path configurable
- **Added**: `const migrationsPath = process.env.MIGRATIONS_PATH || '../../drizzle';`
- **Reason**: Handle different path contexts during build vs runtime

## Key Configuration Details

### Services in render.yaml

1. **PostgreSQL Database** (`brain-database`)
   - Managed PostgreSQL instance
   - Provides `DATABASE_URL` to API service

2. **Redis Instance** (`brain-redis`)
   - Managed Redis instance
   - Provides `REDIS_URL` to API service

3. **API Service** (`brain-api`)
   - Root Directory: `packages/api`
   - Build Command: Installs root deps, then builds API package
   - Auto-runs migrations on build
   - Health Check: `/health`

4. **Frontend Service** (`brain-frontend`)
   - Root Directory: `packages/frontend`
   - Build Command: Installs root deps, then builds frontend
   - Next.js production build

5. **ML Service** (`brain-ml-service`)
   - Root Directory: `packages/ml-service`
   - Build Command: Installs root deps, then builds ML service
   - Health Check: `/health`

### Environment Variable Handling

- **Auto-set by Render**: `DATABASE_URL`, `REDIS_URL`, service URLs
- **Manual setup required**: `ENCRYPTION_KEY`, `JWT_SECRET`, API keys
- **Service references**: URLs automatically linked between services

## Build Process

For each service:
1. Render changes to `rootDir` (package directory)
2. Goes to repo root and installs workspace dependencies
3. Returns to package directory and runs package-specific build
4. For API: runs database migrations automatically

## Notes

- **pnpm-lock.yaml**: If not present, Render will generate it on first build
- **Free tier**: Services may spin down after 15 minutes of inactivity
- **Upgrade**: Consider paid plans for production (24/7 uptime)
- **Migration path**: Automatically resolves relative to build context

## Testing Locally

Before deploying, you can test the build process locally:

```bash
# Test API build
cd packages/api
pnpm install
pnpm run build

# Test Frontend build
cd packages/frontend
pnpm install
pnpm run build

# Test ML service build
cd packages/ml-service
pnpm install
pnpm run build
```

## Next Steps

1. Push code to GitHub
2. Connect repository to Render.com
3. Use "Blueprint" option to import `render.yaml`
4. Set manual environment variables (ENCRYPTION_KEY, JWT_SECRET, API keys)
5. Deploy services
6. Verify health checks are responding
7. Test the application
