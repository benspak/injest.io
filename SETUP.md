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
RESEND_API_KEY=re_your-resend-api-key
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key

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

## 5. Seed a Pro-Tier Developer Account (Optional but Recommended)

API key generation, the `/developers` portal, and `/api/external` routes require a Pro (or higher) subscription tier.

1. Sign up through the frontend and complete the magic-link login.
2. In the backend terminal, run:

   ```bash
   npm run make-plus-user -- your-email@example.com
   ```

   If you omit the email argument the script prompts for it.

3. Refresh the app; the developer docs now unlock, and API key endpoints will succeed.

## 6. Configure Resend Inbound Email

1. Verify your domain in the [Resend Dashboard](https://resend.com/domains).
2. Create the inbound address (e.g., `input@injest.io`) and copy it into your `.env`.
3. Set an inbound webhook:
   - Dashboard → Webhooks → New webhook
   - URL: `https://<your-api-host>/api/email/inbound` (local development requires a tunnel)
   - Events: `email.received`
4. Ensure `api/src/services/email.ts` uses a verified `from` address for outbound messages.

## 7. Verify the Stack

1. **Backend health** – `GET http://localhost:5555/health` returns `{"status":"ok"}`.
2. **Auth flow** – Submit your email at `/login`, click the magic link, and confirm the dashboard loads.
3. **External API** – With a Pro user, visit `http://localhost:3000/developers`, generate an API key, and hit `http://localhost:5555/api/external/items`.
4. **Email ingestion** – Forward an email to your inbound address and confirm it appears in the dashboard after processing.

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
