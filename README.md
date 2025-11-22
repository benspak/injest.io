# Injest.io RAG System

An AI-assisted knowledge recall platform with ingestion pipelines, semantic search, outbound communication workflows, and a Pro-tier external API. This repository hosts the full monorepo:

- `api/` – Express + TypeScript backend (ES modules) with OpenAI-powered enrichment, Stripe billing, and REST APIs.
- `frontend/` – Next.js 14 frontend with the authenticated dashboard, developer docs, and interactive API explorer.
- `chrome-extension/` – Utility extension for capturing links and notes into Injest.
- `*.md` – Developer documentation (`SETUP.md`, `API_DOCUMENTATION.md`, `OPENAI_OPTIMIZATION.md`, etc.).

## Getting Started

1. Follow the full environment walkthrough in `SETUP.md` (PostgreSQL + pgvector, env vars, migrations).
2. Start the backend (`cd api && npm run dev`) and frontend (`cd frontend && npm run dev`).
3. Optional: create a Pro-tier test user with `npm run make-plus-user` so you can exercise external API flows locally.

The backend exposes Swagger-based docs at `/api/openapi.json`, but access is gated by the Pro plan. The frontend’s `/developers` page loads the OpenAPI spec when the signed-in user has the necessary tier.

## Developer Documentation

- `SETUP.md` – Local development, env configuration, and deployment notes.
- `API_DOCUMENTATION.md` – REST endpoints (authenticated vs. external API key access, tasks, send workflows, payments, etc.).
- `OPENAI_OPTIMIZATION.md` – Guidance for tuning prompts, context windows, and model selection.

In-app developer docs live at `http://localhost:3000/developers` when running locally. Users below Pro see upgrade guidance; Pro users can generate API keys, download the spec, and explore endpoints via Swagger UI.

## Maintenance & Operational Jobs

- `npm run migrate` (backend) – Runs TypeScript-powered migrations.
- `npm run reindex-all-items` – Re-enqueues every active item for embeddings and metadata refresh (configure `REINDEX_BATCH_SIZE`/`REINDEX_CONCURRENCY`).
- `npm run extract-contacts-from-ocr-images` – Backfills contacts from historical OCR data.

All scripts should run from the `api` directory.

## Search & Retrieval Highlights

- `/api/search` supports structured filters (type, tags, source, uploaded owner, attachments, date range) and returns scoring metadata per hit.
- Search responses cache per user for 60 seconds and automatically invalidate when items change.
- The dashboard search bar mirrors the backend filters and surfaces similarity + recency insights.
- Embedding defaults: `text-embedding-3-small` (1536 dimensions). If upgrading from 3k-dimension models, run migration `016_force_small_embeddings.sql` and reindex.

## Key Features

### Collections
Organize items into collections with custom colors, icons, and descriptions. Collections can be:
- Shared publicly via share tokens (`/api/collections/shared/:token`)
- Posted to your public profile
- Used to group related items for better organization

### User Profiles
Public user profiles with customizable usernames (`/u/{username}`):
- Bio, headline, company, and project information
- Social links (X.com, YouTube, GitHub, LinkedIn)
- Avatar uploads
- Posted items and collections visible to the public
- Privacy controls to make profiles private

### Item Sharing
Share items with other users via email:
- Grant access by email address
- Recipients receive email notifications with links
- Access works even if recipient doesn't have an account
- Automatic linking when recipient signs up

### Referral System
Earn commissions by referring new users:
- Set custom referral codes
- Track referrals and earnings
- Stripe Connect integration for payouts
- Commission history and statistics

### Integrations

#### Slack
- OAuth integration for workspace access
- Message ingestion from Slack channels
- Search across Slack messages
- Slash commands and interactions
- Event webhooks for real-time updates

#### X.com (Twitter)
- OAuth 2.0 PKCE integration
- Login with X.com account
- Link X.com account to existing user
- Post tweets (with appropriate permissions)

#### Email (Resend)
- Inbound email processing
- Automatic item creation from emails
- Email summaries with AI
- Outbound email sending via send workflow

### Authentication
Multiple authentication methods:
- Magic link (passwordless)
- Username/password login
- X.com OAuth login
- Two-factor authentication (2FA) with recovery codes
- Password recovery via email

## Support

Questions or issues? Open a GitHub issue or contact the team. Internal handoff notes (e.g., Nov 5 2025 Google Docs integration) live in project planning docs rather than this README.
