# Environment Configuration

Copy this template to `.env` in the root directory and fill in your values.

```bash
# API Configuration
API_PORT=3001
API_HOST=0.0.0.0
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ML Service Configuration
ML_PORT=3002
ML_HOST=0.0.0.0
ML_SERVICE_URL=http://localhost:3002

# Database Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/brain

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Encryption Key (generate a secure 32+ character string for production)
ENCRYPTION_KEY=change-me-in-production-32-chars-minimum

# JWT Secret (generate a secure random string for production)
JWT_SECRET=change-me-in-production-secret-key

# AI/ML API Keys (optional - for NLQ features)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Google Analytics OAuth (for Google Analytics connector)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Salesforce OAuth (for Salesforce connector)
SALESFORCE_CLIENT_ID=
SALESFORCE_CLIENT_SECRET=

# HubSpot OAuth (for HubSpot connector)
HUBSPOT_CLIENT_ID=
HUBSPOT_CLIENT_SECRET=
```

## Quick Start

1. Start infrastructure services:
```bash
docker-compose up -d
```

2. Install dependencies:
```bash
pnpm install
```

3. Run database migrations:
```bash
cd packages/api
pnpm db:migrate
```

4. Start all services:
```bash
pnpm dev
```

This will start:
- API server on http://localhost:3001
- Frontend on http://localhost:3000
- ML service on http://localhost:3002

## Security Notes

- **ENCRYPTION_KEY**: Use a strong, random 32+ character string in production
- **JWT_SECRET**: Use a strong, random secret for JWT signing
- Never commit `.env` files to version control
