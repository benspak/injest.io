# ✅ Render.com Deployment - Quick Start

Your Brain AI MVP is **fully deployable** on Render.com!

## 🚀 One-Click Deploy

1. **Push to GitHub/GitLab/Bitbucket**
2. **In Render Dashboard**: New → Blueprint
3. **Connect repository** with `render.yaml`
4. **Set environment variables** (see below)
5. **Deploy!**

Render will automatically:
- ✅ Create PostgreSQL database with pgvector support
- ✅ Create Redis instance
- ✅ Deploy API service
- ✅ Deploy Frontend service
- ✅ Deploy Worker service
- ✅ Run migrations
- ✅ Enable pgvector extension

## 🔑 Required Environment Variables

Set these in Render Dashboard before first deploy:

### For API Service:
- `OPENAI_API_KEY` - Your OpenAI API key
- `JWT_SECRET` - Generate random secret (use Render's "Generate Value")

### All other variables are auto-configured from `render.yaml`

## 📋 What Gets Deployed

- **Backend API** (`packages/api`) - Express server on port 10000
- **Frontend** (`packages/frontend`) - Next.js app
- **Background Workers** (`packages/api`) - BullMQ workers for processing
- **PostgreSQL** - Database with pgvector extension
- **Redis** - Job queue

## ✅ Verification Checklist

After deployment:

1. ✅ API health: `https://your-api.onrender.com/health`
2. ✅ Frontend loads: `https://your-frontend.onrender.com`
3. ✅ Database: Check API logs for "Migrations complete!"
4. ✅ pgvector: Check API logs for "pgvector extension enabled"
5. ✅ Workers: Check worker service logs for "Workers started"

## 💰 Estimated Cost

**Starter Plans** (MVP/Testing):
- PostgreSQL: $7/month
- Redis: $10/month
- API: $7/month
- Frontend: $7/month
- Workers: $7/month
- **Total: ~$38/month**

**Production Plans** (Recommended for scale):
- Standard plans: ~$100-200/month

## 🔧 Post-Deployment

1. **Update Chrome Extension**: Change API URL in `packages/chrome-ext/popup.js`
2. **Test Authentication**: Try login flow
3. **Test Capture**: Create an item
4. **Monitor Logs**: Check all services are running

## 📚 Full Documentation

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed setup, troubleshooting, and scaling guide.

## ⚠️ Important Notes

- **pgvector**: The postdeploy script enables pgvector automatically on first deploy
- **Migrations**: Run automatically on API service startup
- **Workers**: Must be running for background processing (embeddings, auto-structuring)
- **CORS**: Already configured, but verify frontend URL matches BASE_URL

## 🐛 Common Issues

1. **"pgvector not found"**: Wait for postdeploy to run, or enable manually via Render Shell
2. **Workers not processing**: Verify Redis URL and worker service is running
3. **Build fails**: Check for TypeScript errors in build logs

## ✨ Ready to Deploy!

Your MVP is production-ready. Just push to your repo and deploy via Render Blueprint!
