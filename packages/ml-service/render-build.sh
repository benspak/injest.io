#!/bin/bash
# Build script for ML service on Render
set -e

echo "Installing root dependencies..."
cd ../..
pnpm install --frozen-lockfile

echo "Building ML service..."
cd packages/ml-service
pnpm install
pnpm run build

echo "Build complete!"
