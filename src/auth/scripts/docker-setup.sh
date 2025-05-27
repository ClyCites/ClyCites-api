#!/bin/bash

# ClyCites Auth Docker Setup Script

set -e

echo "🐳 Setting up ClyCites Authentication Server with Docker"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p nginx/conf.d
mkdir -p ssl
mkdir -p logs/nginx
mkdir -p uploads/profiles
mkdir -p uploads/documents

# Set proper permissions
chmod 755 uploads
chmod 755 logs

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Copying from .env.example..."
    cp .env.example .env
    echo "📝 Please edit .env file with your configuration before proceeding."
    exit 1
fi

# Generate self-signed SSL certificates for development
if [ ! -f ssl/cert.pem ] || [ ! -f ssl/key.pem ]; then
    echo "🔐 Generating self-signed SSL certificates for development..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ssl/key.pem \
        -out ssl/cert.pem \
        -subj "/C=UG/ST=Central/L=Kampala/O=ClyCites/OU=IT/CN=localhost"
    echo "✅ SSL certificates generated"
fi

# Build and start services
echo "🚀 Building and starting services..."

if [ "$1" = "dev" ]; then
    echo "🔧 Starting in development mode..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d
else
    echo "🏭 Starting in production mode..."
    docker-compose up --build -d
fi

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo "🏥 Checking service health..."
if curl -f http://localhost:5000/health > /dev/null 2>&1; then
    echo "✅ ClyCites Auth Server is healthy"
else
    echo "❌ ClyCites Auth Server is not responding"
    echo "📋 Checking logs..."
    docker-compose logs clycites-auth
fi

if curl -f http://localhost:80/health > /dev/null 2>&1; then
    echo "✅ Nginx proxy is healthy"
else
    echo "❌ Nginx proxy is not responding"
    echo "📋 Checking logs..."
    docker-compose logs nginx
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📍 Service URLs:"
echo "   • Auth Server: http://localhost:5000"
echo "   • Nginx Proxy: http://localhost:80"
echo "   • API Docs: http://localhost:5000/api/docs"
echo "   • Health Check: http://localhost:5000/health"

if [ "$1" = "dev" ]; then
    echo "   • MongoDB Express: http://localhost:8081"
    echo "   • Dev Nginx: http://localhost:8080"
fi

echo ""
echo "🔧 Useful commands:"
echo "   • View logs: docker-compose logs -f"
echo "   • Stop services: docker-compose down"
echo "   • Restart: docker-compose restart"
echo "   • Rebuild: docker-compose up --build -d"
echo ""
echo "📝 Next steps:"
echo "   1. Run database seeding: docker-compose exec clycites-auth npm run seed"
echo "   2. Test the API endpoints"
echo "   3. Configure your client applications"
