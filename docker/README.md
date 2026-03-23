# Docker Development Environment

## Quick Start

```bash
# Copy environment template
cp .env.example .env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

## Services

| Service | URL | Description |
|---------|-----|-------------|
| Frontend Shell | http://localhost:3000 | Main app entry |
| Frontend Core | http://localhost:3002 | Core MFE |
| Gateway | http://localhost:5000 | API Gateway |
| Identity | http://localhost:5101 | Auth service |
| Training | http://localhost:5201 | Training service |
| CoreHR | http://localhost:5301 | CoreHR service |
| PostgreSQL | localhost:5432 | Database |

## Common Commands

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Rebuild single service
docker-compose build identity
docker-compose up -d identity

# View logs
docker-compose logs -f gateway

# Reset database
docker-compose down -v
docker-compose up -d

# Shell into container
docker-compose exec postgres psql -U fusion -d fusion_identity
```

## Troubleshooting

**Services not starting?**
- Check logs: `docker-compose logs <service>`
- Ensure ports aren't in use

**Database connection issues?**
- Wait for postgres healthcheck
- Check connection string in logs
