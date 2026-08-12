#!/bin/sh
set -e

echo ""
echo "====================================="
echo "  SellerHill API - Starting"
echo "====================================="
echo ""

# Run database migrations
echo "📦 Running database migrations..."
node dist/scripts/migrate.js

echo ""
echo "🚀 Starting API server..."
exec "$@"
