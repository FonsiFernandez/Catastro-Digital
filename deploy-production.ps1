# Catastro Digital v1.0.0 - production helper
# Run from the repository root on a machine with Docker Compose.

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".env.production")) {
    Write-Error ".env.production not found. Copy .env.production.example to .env.production and fill in real values first."
}

Write-Host "Validating Docker Compose configuration..."
docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet

Write-Host "Building and starting Catastro Digital..."
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build

Write-Host "Current service status:"
docker compose --env-file .env.production -f docker-compose.prod.yml ps
