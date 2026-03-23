# Docker Development Environment

Simple Docker setup for local development.

## Quick Start

```bash
# Copy environment file
cp .env.example .env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

Access the app at **http://localhost:3000**

## Services

| Service | URL | Description |
|---------|-----|-------------|
| Frontend Shell | http://localhost:3000 | Main app |
| Frontend Core | http://localhost:3002 | Core MFE |
| Gateway | http://localhost:5000 | API Gateway |
| Identity | http://localhost:5101 | Auth API |
| Training | http://localhost:5201 | Training API |
| CoreHR | http://localhost:5301 | CoreHR API |
| PostgreSQL | localhost:5432 | Database |

## Commands

```bash
# Start all services
docker-compose up -d

# Stop all services  
docker-compose down

# Rebuild specific service
docker-compose build identity
docker-compose up -d identity

# View logs
docker-compose logs -f gateway

# Reset everything
docker-compose down -v
docker-compose up -d
```

## Database Access

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U fusion

# List databases
docker-compose exec postgres psql -U fusion -l

# Connect to specific database
docker-compose exec postgres psql -U fusion -d fusion_identity
```

## Troubleshooting

**Services not starting?**
- Check logs: `docker-compose logs <service>`
- Ensure ports aren't in use locally

**Database connection issues?**
- PostgreSQL takes ~10s to initialize
- Check connection strings in service logs

**Frontend build failures?**
- Clean rebuild: `docker-compose build --no-cache frontend-shell`
- Check pnpm workspace dependencies
