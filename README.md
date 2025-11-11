# Injest.io RAG System

An AI-assisted knowledge recall platform with ingestion pipelines, semantic search, outbound communication workflows, and a Plus-tier external API. This repository hosts the full monorepo:

- `api/` – Express + TypeScript backend (ES modules) with OpenAI-powered enrichment, Stripe billing, and REST APIs.
- `frontend/` – Next.js 14 frontend with the authenticated dashboard, developer docs, and interactive API explorer.
- `chrome-extension/` – Utility extension for capturing links and notes into Injest.
- `*.md` – Developer documentation (`SETUP.md`, `API_DOCUMENTATION.md`, `OPENAI_OPTIMIZATION.md`, etc.).

## Getting Started

1. Follow the full environment walkthrough in `SETUP.md` (PostgreSQL + pgvector, env vars, migrations).
2. Start the backend (`cd api && npm run dev`) and frontend (`cd frontend && npm run dev`).
3. Optional: create a Plus-tier test user with `npm run make-plus-user` so you can exercise external API flows locally.

The backend exposes Swagger-based docs at `/api/openapi.json`, but access is gated by the Plus plan. The frontend’s `/developers` page loads the OpenAPI spec when the signed-in user has the necessary tier.

## Developer Documentation

- `SETUP.md` – Local development, env configuration, and deployment notes.
- `API_DOCUMENTATION.md` – REST endpoints (authenticated vs. external API key access, tasks, send workflows, payments, etc.).
- `OPENAI_OPTIMIZATION.md` – Guidance for tuning prompts, context windows, and model selection.

In-app developer docs live at `http://localhost:3000/developers` when running locally. Users below Plus see upgrade guidance; Plus users can generate API keys, download the spec, and explore endpoints via Swagger UI.

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

## Support

Questions or issues? Open a GitHub issue or contact the team. Internal handoff notes (e.g., Nov 5 2025 Google Docs integration) live in project planning docs rather than this README.
