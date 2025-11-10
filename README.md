# Injest.io RAG System

A knowledge recall system with email ingestion, vector indexing, semantic search, and AI-powered features.

## Setup

See SETUP.md

## Seed Prompt Used

See SEED.md

## Ben to Dom Handoff Nov 5th 2025.

Remember, remember ... that you're working on Google DOCs integration.

## Search Improvements

- `/api/search` supports structured filters (type, tags, source, uploaded owner, attachments, date range) and returns detailed scoring metadata for each hit.
- Search responses are cached per user for 60 seconds and automatically invalidated when items are indexed, shared, updated, or deleted.
- The dashboard search bar now includes filter controls (type, uploaded by, tags, attachments) and highlights result metadata such as recency, source, and vector score breakdown.
- Embeddings now default to `text-embedding-3-small` (1536 dims). Run migrations (including `016_force_small_embeddings.sql`) and re-index items when upgrading from older deployments that used 3072-dimension embeddings.

## Maintenance Jobs

- Run `npm run reindex-all-items` from the `api` directory (ideally via a daily cron job) to reindex every active user item. Configure `REINDEX_BATCH_SIZE` and `REINDEX_CONCURRENCY` environment variables to tune throughput.
