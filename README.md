# Brain - AI/ML Data Aggregation Platform

A unified platform that connects business users' data from multiple third-party sources and provides AI-powered insights, queries, and visualizations.

## Architecture

Monorepo structure with multiple packages:
- `packages/api` - Main API gateway
- `packages/connectors` - Data source connectors
- `packages/ml-service` - AI/ML processing service
- `packages/frontend` - Next.js web application
- `packages/shared` - Shared types and utilities

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL 14+
- Redis 6+

### Installation

```bash
pnpm install
```

### Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### Development

Start all services in development mode:

```bash
pnpm dev
```

This will start:
- API server on http://localhost:3001
- Frontend on http://localhost:3000
- ML service on http://localhost:3002

### Building

Build all packages:

```bash
pnpm build
```

## Project Structure

```
brain/
├── packages/
│   ├── api/              # Main API gateway
│   ├── connectors/       # Data source connectors
│   ├── ml-service/       # AI/ML processing service
│   ├── frontend/         # Next.js web app
│   └── shared/           # Shared types/utils
├── infrastructure/       # Docker, K8s configs
└── docs/                # Documentation
```

## Tech Stack

- **Backend**: Node.js, TypeScript (ES modules), Express
- **Frontend**: Next.js, TypeScript, Tailwind CSS
- **Database**: PostgreSQL, TimescaleDB, Redis
- **AI/ML**: TensorFlow.js, OpenAI API
- **Queue**: BullMQ (Redis-based)
