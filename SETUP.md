# Setup Guide for Injest.io

This guide will walk you through setting up the Injest.io RAG system locally.

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ with pgvector extension
- OpenAI API key
- Resend API key
- Git

## Step 1: Clone the Repository

```bash
git clone <repository-url>
cd injest.io
```

## Step 2: Database Setup

### Install PostgreSQL

Make sure PostgreSQL is installed and running on your system.

### Install pgvector Extension

```bash
# On macOS (using Homebrew)
brew install pgvector

# On Ubuntu/Debian
sudo apt-get install postgresql-14-pgvector

# Or build from source
git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git
cd pgvector
make
make install
```

### Create Database

```bash
# Connect to PostgreSQL
psql postgres

# Create database and user
CREATE DATABASE injest;
CREATE USER injest_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE injest TO injest_user;

# Connect to the database
\c injest

# Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

# Exit psql
\q
```

## Step 3: Backend Setup

### Install Dependencies

```bash
cd api
npm install
```

### Configure Environment Variables

Copy the example environment file:

```bash
cp env.example .env
```

Edit `.env` with your actual values:

```bash
# Database - Update with your PostgreSQL credentials
DATABASE_URL=postgresql://injest_user:your_password@localhost:5432/injest

# JWT - Generate a strong secret key
JWT_SECRET=your-very-secure-secret-key-here
JWT_EXPIRES_IN=7d

# OpenAI - Get from https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-your-openai-api-key

# Resend - Get from https://resend.com/api-keys
RESEND_API_KEY=re_your-resend-api-key

# Application URLs
PORT=5555
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
API_URL=http://localhost:5555

# File Storage
UPLOAD_DIR=./uploads
```

### Run Database Migrations

```bash
npm run migrate
```

This will create all necessary tables and set up the database schema.

### Start the Backend Server

```bash
npm run dev
```

The API will be available at `http://localhost:5555`

## Step 4: Frontend Setup

### Install Dependencies

Open a new terminal window:

```bash
cd frontend
npm install
```

### Configure Environment Variables

Copy the example environment file:

```bash
cp env.example .env.local
```

Edit `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:5555
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Start the Frontend Development Server

```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

## Step 5: Configure Resend Email

### Set Up Resend Domain

1. Go to [Resend Dashboard](https://resend.com/domains)
2. Add and verify your domain (e.g., `injest.io`)
3. Configure DNS records as instructed

### Configure Email Address

1. In Resend, create an email address: `input@injest.io`
2. Set up an inbound webhook:
   - Go to Resend Dashboard → Webhooks
   - Create a new webhook
   - Set the endpoint URL to: `https://your-api-url.com/api/email/inbound`
   - Select events: `email.received`

### Update Email Service

Make sure the `from` email address in `api/src/services/email.ts` matches your verified Resend domain.

## Step 6: Verify Setup

### Test Backend

1. Open `http://localhost:5555/health`
2. You should see: `{"status":"ok"}`

### Test Frontend

1. Open `http://localhost:3000`
2. You should see the landing page
3. Click "Get Started" to test the login flow

### Test Authentication

1. Go to `http://localhost:3000/login`
2. Enter your email address
3. Check your email for the magic link
4. Click the link to verify authentication

## Step 7: Test Email Ingestion

1. After verifying your email, you should receive an approval email
2. Send an email to `input@injest.io` from your verified email address
3. The email should be processed and appear in your dashboard

## Troubleshooting

### Database Connection Issues

- Verify PostgreSQL is running: `pg_isready`
- Check database credentials in `.env`
- Verify pgvector extension: `psql -d injest -c "SELECT * FROM pg_extension WHERE extname = 'vector';"`

### Migration Errors

If migrations fail:
- Ensure pgvector extension is installed
- Check database user has proper permissions
- Verify DATABASE_URL is correct

### Port Already in Use

If port 5555 or 3000 is already in use:
- Change PORT in backend `.env`
- Update NEXT_PUBLIC_API_URL in frontend `.env.local`
- Or stop the conflicting service

### OpenAI API Errors

- Verify your API key is correct
- Check you have available credits
- Ensure you're using the correct model name

### Resend Email Issues

- Verify your Resend API key
- Check domain is verified in Resend
- Ensure webhook endpoint is publicly accessible (for production)
- Check webhook logs in Resend dashboard

### File Upload Issues

- Ensure `UPLOAD_DIR` directory exists or is writable
- Check file size limits (default: 50MB)
- Verify multer configuration

## Production Deployment

See `render.yaml` for Render.com deployment configuration. Update environment variables in your hosting platform:

1. Set all environment variables in your hosting dashboard
2. Ensure database connection string is correct
3. Update FRONTEND_URL and API_URL to production URLs
4. Configure Resend webhook to point to production API URL
5. Run migrations on production database

## Next Steps

- Set up SSL certificates for production
- Configure CORS settings for your domain
- Set up monitoring and logging
- Configure backup strategy for database
- Review and update security settings

## Support

For issues or questions, please refer to the main README.md or open an issue in the repository.
