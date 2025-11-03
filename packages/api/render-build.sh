#!/bin/bash
# Build script for Render.com deployment
set -e

echo "🔨 Building Brain AI API..."

# Install dependencies
pnpm install --frozen-lockfile

# Build TypeScript
pnpm build

# Run migrations (this will be run on first deploy)
echo "✅ Build complete!"
