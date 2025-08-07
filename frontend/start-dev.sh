#!/bin/bash

# BEACON Frontend Development Starter Script
set -e

echo "🚀 Starting BEACON Frontend Development Environment"

# Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the frontend directory."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Create .env.development if it doesn't exist
if [ ! -f ".env.development" ]; then
    echo "⚙️ Creating development environment file..."
    cp .env.example .env.development
fi

echo "✅ Starting React development server..."
echo "🌐 Frontend will be available at: http://localhost:3000"
echo "🔗 Backend should be running at: http://localhost:5001"
echo ""
echo "Press Ctrl+C to stop the development server"

# Start the development server
npm start