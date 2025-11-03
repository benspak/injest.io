#!/bin/bash
# Build script for Render.com deployment
set -e

echo "🔨 Building Brain AI Frontend..."

# Install dependencies
pnpm install --frozen-lockfile

# Build Next.js
pnpm build

echo "✅ Build complete!"
