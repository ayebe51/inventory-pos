#!/bin/bash

# Exit on any error
set -e

echo "=================================================="
echo " Enterprise Inventory + POS Deployment Script"
echo "=================================================="

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "Error: docker-compose is not installed. Please install docker-compose first."
    exit 1
fi

echo "[1/4] Copying .env environment file if it doesn't exist..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo ".env file created from .env.example. Please update the secrets before running again."
    # We won't exit here, just warn, since docker-compose will use defaults
    echo "WARNING: Using default secrets. This is not recommended for production."
fi

echo "[2/4] Building and starting Docker containers..."
docker-compose up -d --build

echo "[3/4] Waiting for Database to be ready..."
# Docker-compose will handle the healthcheck, but we pause a bit to let Prisma connect
sleep 15

echo "[4/4] Running Database Migrations and Seeding..."
# Run prisma migrate and seed inside the backend container
docker-compose exec -T backend npx prisma migrate deploy
docker-compose exec -T backend npm run prisma:seed

echo "=================================================="
echo " Deployment Complete!"
echo " Frontend: http://localhost:80"
echo " Backend API: http://localhost:3000/api"
echo " Swagger Docs: http://localhost:3000/api/docs"
echo "=================================================="
