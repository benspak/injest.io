#!/bin/bash
# Render.com start script for API

set -e

echo "🗄️ Running database migrations..."
pnpm db:migrate

echo "🚀 Starting API server..."
pnpm start
