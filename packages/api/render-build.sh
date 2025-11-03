#!/bin/bash
# Build script for API service on Render
set -e

echo "Installing root dependencies..."
cd ../..
pnpm install --frozen-lockfile

echo "Building API service..."
cd packages/api
pnpm install
pnpm run build

echo "Running database migrations..."
pnpm run db:migrate || echo "Migrations may have already run, continuing..."

echo "Build complete!"
