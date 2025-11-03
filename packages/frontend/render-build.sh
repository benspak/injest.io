#!/bin/bash
# Build script for Frontend service on Render
set -e

echo "Installing root dependencies..."
cd ../..
pnpm install --frozen-lockfile

echo "Building Frontend service..."
cd packages/frontend
pnpm install
pnpm run build

echo "Build complete!"
