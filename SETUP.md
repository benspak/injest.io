# Setup Guide for Injest.io

Run through these steps to bring up the full Injest.io stack locally.

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ with the `pgvector` extension
- OpenAI API key (platform.openai.com)
- Resend API key (resend.com)
- Stripe test keys (secret + publishable) for payments
- Git and a shell (examples assume macOS/Linux; adapt as needed)

Optional tools: `pg_isready` for connection checks, `stripe` CLI for webhook simulation, and a tunnelling service (e.g., ngrok) if you need external callbacks.

## 1. Clone the Repository

```bash
git clone <repository-url>
cd injest.io
```

## 2. Database Setup

### Install PostgreSQL + pgvector

```bash
# macOS (Homebrew)
brew install postgresql@14 pgvector

# Ubuntu/Debian
sudo apt-get install postgresql-14 postgresql-14-pgvector
```

Alternatively, build pgvector from source:

```bash
git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

### Create the database

```bash
psql postgres
```

Inside `psql`:

```sql
CREATE DATABASE injest;
CREATE USER injest_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE injest TO injest_user;
\c injest
CREATE EXTENSION IF NOT EXISTS vector;
\q
```

## 3. Backend (`api/`) Setup

Install dependencies:

```bash
cd api
npm install
```

Copy the environment template and populate it:

```bash
cp env.example .env
```

Key fields to update in `.env`:

```bash
# Database
DATABASE_URL=postgresql://injest_user:your_password@localhost:5432/injest
PGVECTOR_ENABLED=true

# Auth
JWT_SECRET=replace-with-a-strong-secret
JWT_EXPIRES_IN=7d

# Third-party services
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_EMBEDDING_MODEL=small  # Options: small (default, 1536 dims) or large (3072 dims)
RESEND_API_KEY=re_your-resend-api-key
RECEIVING_EMAIL=input@injest.io  # Email address for receiving inbound emails
INBOUND_EMAIL_DOMAIN=injest.io  # Domain for inbound email routing
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
# Optional: For affiliate program webhooks
# STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# Slack Integration (Optional)
# SLACK_CLIENT_ID=your-slack-client-id
# SLACK_CLIENT_SECRET=your-slack-client-secret
# SLACK_SIGNING_SECRET=your-slack-signing-secret
# SLACK_REDIRECT_URI=http://localhost:5555/api/slack/oauth/callback

# X.com Integration (Optional)
# X_CLIENT_ID=your-x-client-id
# X_CLIENT_SECRET=your-x-client-secret
# X_REDIRECT_URI=http://localhost:5555/api/auth/xcom/callback  # Optional, auto-constructed from API_URL if not set

# App URLs (use absolute URLs with protocol)
PORT=5555
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
API_URL=http://localhost:5555

# File storage
UPLOAD_DIR=./uploads
```

Run migrations to create schema, vector indexes, and metadata tables:

```bash
npm run migrate
```

Start the backend in watch mode:

```bash
npm run dev
```

Visit `http://localhost:5555/health` to confirm the API is responding.

## 4. Frontend (`frontend/`) Setup

In a second terminal:

```bash
cd frontend
npm install
cp env.example .env.local
```

Edit `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:5555
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key
```

Start the Next.js dev server:

```bash
npm run dev
```

Open `http://localhost:3000` to see the dashboard. The onboarding flow uses passwordless magic links via Resend.

## 5. Configure Stripe Connect for Affiliate Program (Optional)

If you want to enable the affiliate program where users can earn commissions:

1. Complete Stripe Connect platform onboarding:
   - Go to https://dashboard.stripe.com/settings/connect/platform-profile
   - Fill out your platform information
   - This is a one-time setup required before creating connected accounts

2. Configure Stripe webhook for commission processing:
   - In Stripe Dashboard → Webhooks → Add endpoint
   - URL: `https://<your-api-host>/api/stripe-webhook`
   - Events to listen for: `payment_intent.succeeded`, `payment_intent.payment_failed`
   - Copy the webhook signing secret and add to `.env`:
     ```bash
     STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
     ```

3. For local development, use Stripe CLI to forward webhooks:
   ```bash
   stripe listen --forward-to localhost:5555/api/stripe-webhook
   ```

## 6. Seed a Pro-Tier Developer Account (Optional but Recommended)

API key generation, the `/developers` portal, and `/api/external` routes require a Pro (or higher) subscription tier.

1. Sign up through the frontend and complete the magic-link login.
2. In the backend terminal, run:

   ```bash
   npm run make-plus-user -- your-email@example.com
   ```

   If you omit the email argument the script prompts for it.

3. Refresh the app; the developer docs now unlock, and API key endpoints will succeed.

## 7. Configure Resend Inbound Email

1. Verify your domain in the [Resend Dashboard](https://resend.com/domains).
2. Configure inbound email for your domain (for example, `username@injest.io` for each user).
3. Set an inbound webhook:
   - Dashboard → Webhooks → New webhook
   - URL: `https://<your-api-host>/api/email/inbound` (local development requires a tunnel)
   - Events: `email.received`
4. Ensure `api/src/services/email.ts` uses a verified `from` address for outbound messages.
5. Set `RECEIVING_EMAIL` and `INBOUND_EMAIL_DOMAIN` in your `.env` file.

## 8. Configure Slack Integration (Optional)

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps).
2. Configure OAuth & Permissions:
   - Redirect URL: `http://localhost:5555/api/slack/oauth/callback` (development) or `https://<your-api-host>/api/slack/oauth/callback` (production)
   - Scopes: `channels:read`, `channels:history`, `groups:read`, `groups:history`, `im:read`, `im:history`, `mpim:read`, `mpim:history`, `users:read`
3. Enable Events API:
   - Request URL: `https://<your-api-host>/api/slack/events`
   - Subscribe to: `message.channels`, `message.groups`, `message.im`, `message.mpim`
4. Enable Slash Commands (optional):
   - Command URL: `https://<your-api-host>/api/slack/commands`
5. Copy credentials to `.env`:
   - `SLACK_CLIENT_ID`
   - `SLACK_CLIENT_SECRET`
   - `SLACK_SIGNING_SECRET`
   - `SLACK_REDIRECT_URI`

## 9. Configure X.com Integration (Optional)

1. Create an app at [developer.twitter.com](https://developer.twitter.com/en/portal/dashboard).
2. Configure OAuth 2.0 settings:
   - App permissions: Read and Write (for posting tweets)
   - Callback URL: `http://localhost:5555/api/auth/xcom/callback` (development) or `https://<your-api-host>/api/auth/xcom/callback` (production)
   - Type: Web App
3. Copy credentials to `.env`:
   - `X_CLIENT_ID`
   - `X_CLIENT_SECRET`
   - `X_REDIRECT_URI` (optional, auto-constructed from `API_URL` if not set)

**Note:** X.com integration uses PKCE (Proof Key for Code Exchange) for enhanced security.

## 10. Verify the Stack

1. **Backend health** – `GET http://localhost:5555/health` returns `{"status":"ok"}`.
2. **Auth flow** – Submit your email at `/login`, click the magic link, and confirm the dashboard loads.
3. **External API** – With a Pro user, visit `http://localhost:3000/developers`, generate an API key, and hit `http://localhost:5555/api/external/items`.
4. **Email ingestion** – Forward an email to your inbound address and confirm it appears in the dashboard after processing.

## 11. Additional Features

### Collections
Collections allow you to organize items into groups. Collections can be:
- Shared publicly via share tokens
- Posted to your public profile
- Customized with colors and icons

### User Profiles
Users can create public profiles with:
- Custom usernames (`/u/{username}`)
- Bio, headline, company, project information
- Social links (X.com, YouTube, GitHub, LinkedIn)
- Avatar uploads
- Posted items and collections

### Referral System
Users can earn commissions by referring new users:
1. Set a referral code via `/api/referral/code`
2. New users can sign up with a referral code
3. Commissions are paid when referred users upgrade to Pro
4. Requires Stripe Connect account setup for payouts

### Item Sharing
Items can be shared with other users via email:
- Recipients receive an email with a link to view the item
- Access is granted even if recipient doesn't have an account
- Access is automatically linked when recipient signs up

## Troubleshooting

- **Database connection**: `pg_isready -d injest -U injest_user`; confirm `DATABASE_URL` matches.
- **pgvector missing**: Ensure `CREATE EXTENSION vector;` ran inside the `injest` database and `PGVECTOR_ENABLED=true`.
- **Migrations fail**: Check user permissions and that the database user can create extensions/tables.
- **Port conflicts**: Adjust `PORT` or `NEXT_PUBLIC_API_URL` if 5555/3000 are occupied.
- **OpenAI issues**: Verify credits, model name, and network access; errors surface in API logs.
- **Resend webhooks**: For local development, expose `/api/email/inbound` via ngrok (Resend requires a public URL).
- **Swagger/OpenAPI blocked**: Only Pro accounts can fetch `/api/openapi.json` or load the embedded docs. Upgrade the test user via `npm run make-plus-user`.
- **Large uploads**: Files over 25 MB are rejected. Ensure `UPLOAD_DIR` exists and the process has write permissions.

## Production Deployment

Render.com configuration lives in `render.yaml`. Before deploying:

1. Set all environment variables (backend + frontend) in your hosting provider.
2. Point `FRONTEND_URL` and `API_URL` to the production domains.
3. Run migrations against the production database (`npm run migrate`).
4. Update the Resend webhook to the production API URL.
5. Configure Stripe webhooks or billing flows as needed.
6. Enable SSL, monitoring, backups, and tighten CORS based on your deployment.

## Support & Next Steps

- Review `API_DOCUMENTATION.md` for endpoint-level details.
- Check `OPENAI_OPTIMIZATION.md` for guidance on prompt/embedding tuning.
- For questions, open an issue or contact the team. Continuous deployment and integration hooks should live outside this document.
