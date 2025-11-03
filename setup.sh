#!/bin/bash

echo "🚀 Setting up Brain AI Data Platform..."

# Check for required tools
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm is required but not installed. Install it with: npm install -g pnpm"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed."; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "❌ docker-compose is required but not installed."; exit 1; }

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Start Docker services
echo "🐳 Starting Docker services (PostgreSQL, Redis, MinIO)..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 5

# Run database migrations
echo "🗄️  Running database migrations..."
cd packages/api
pnpm db:generate
pnpm db:migrate
cd ../..

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
  echo "📝 Creating .env file..."
  cp .env.example .env
  echo "✅ Created .env file. Please update it with your configuration."
fi

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env with your API keys (OPENAI_API_KEY or ANTHROPIC_API_KEY)"
echo "2. Run 'pnpm dev' to start all services"
echo "3. Visit http://localhost:3000 for the frontend"
echo "4. Visit http://localhost:3001/health for the API health check"
