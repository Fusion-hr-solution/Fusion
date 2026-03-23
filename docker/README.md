# Docker Development Environment

Docker setup for local development of the EY HR Platform.

## Quick Start

```bash
# 1. Copy environment file and configure it
cp .env.example .env
# IMPORTANT: Edit .env and set JWT_SECRET to a strong random value
# Linux/macOS: openssl rand -base64 48
# Windows PowerShell: [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))

# 2. Start all services (use 'docker compose' or 'docker-compose')
docker compose up -d
# Or: docker-compose up -d (if you have the legacy CLI installed)

# 3. Wait for health checks (~30-60s on first run)
docker compose ps

# 4. Access the app
open http://localhost:3000
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Frontend Shell │────▶│  API Gateway    │────▶│  Identity       │
│  :3000          │     │  :5000          │     │  :5101          │
└─────────────────┘     └─────────────────┘     ├─────────────────┤
┌─────────────────┐            │                │  Training       │
│  Frontend Core  │            │                │  :5201          │
│  :3002          │            │                ├─────────────────┤
└─────────────────┘            │                │  CoreHR         │
                               │                │  :5301          │
                               ▼                └─────────────────┘
                        ┌─────────────────┐
                        │  PostgreSQL     │
                        │  :5432          │
                        └─────────────────┘
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| `frontend-shell` | 3000 | Main app shell (Next.js) |
| `frontend-core` | 3002 | Core MFE module |
| `gateway` | 5000 | YARP API Gateway |
| `identity` | 5101 | Auth & user management |
| `training` | 5201 | Training module API |
| `corehr` | 5301 | CoreHR module API |
| `postgres` | 5432 | PostgreSQL (3 databases) |

## Commands

**Note:** Use `docker compose` (v2, recommended) or `docker-compose` (legacy) depending on your installation.

### Daily Use

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# View all logs
docker compose logs -f

# View specific service logs
docker compose logs -f gateway identity
```

### Rebuilding

```bash
# Rebuild single service
docker compose build identity
docker compose up -d identity

# Rebuild without cache (clean build)
docker compose build --no-cache identity

# Rebuild all services
docker compose build
docker compose up -d
```

### Reset

```bash
# Stop and remove volumes (database data)
docker compose down -v

# Full reset (also removes images)
docker compose down -v --rmi local
docker compose up -d
```

## Database

Three PostgreSQL databases are auto-created on first startup:

| Database | Service |
|----------|---------|
| `fusion_identity` | Identity service |
| `fusion_training` | Training service |
| `fusion_corehr` | CoreHR service |

### Access

```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U fusion

# List databases
docker compose exec postgres psql -U fusion -l

# Connect to specific database
docker compose exec postgres psql -U fusion -d fusion_identity

# Run SQL file
docker compose exec -T postgres psql -U fusion -d fusion_identity < script.sql
```

## Environment Variables

Copy `.env.example` to `.env` and customize:

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | `fusion` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `FusionDev123!` | PostgreSQL password |
| `JWT_SECRET` | `CHANGE_ME` | JWT signing key (min 32 chars) - **must be set** |
| `GATEWAY_PORT` | `5000` | Gateway host port |
| `FRONTEND_SHELL_PORT` | `3000` | Frontend shell host port |

**Important:** Generate a strong JWT secret before starting:
```bash
# Linux/macOS
openssl rand -base64 48

# Windows PowerShell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

## Adding a New Service

### Backend (.NET)

1. Create `Backend/EY.HRPlatform.NewService/Dockerfile`:

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src
COPY ["EY.HRPlatform.NewService/EY.HRPlatform.NewService.csproj", "EY.HRPlatform.NewService/"]
COPY ["EY.HRPlatform.SharedKernel/EY.HRPlatform.SharedKernel.csproj", "EY.HRPlatform.SharedKernel/"]
RUN dotnet restore "EY.HRPlatform.NewService/EY.HRPlatform.NewService.csproj"
COPY . .
WORKDIR /src/EY.HRPlatform.NewService
RUN dotnet publish -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS runtime
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:5401
ENV ASPNETCORE_ENVIRONMENT=Docker
EXPOSE 5401
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5401/health || exit 1
ENTRYPOINT ["dotnet", "EY.HRPlatform.NewService.dll"]
```

2. Add to `docker-compose.yml`:

```yaml
newservice:
  build:
    context: ./Backend
    dockerfile: EY.HRPlatform.NewService/Dockerfile
  container_name: fusion-newservice
  environment:
    ASPNETCORE_ENVIRONMENT: Docker
    ConnectionStrings__NewServiceDb: Host=postgres;Database=fusion_newservice;...
  depends_on:
    postgres:
      condition: service_healthy
  networks:
    - fusion-net
```

3. Add database to `docker/postgres/init-databases.sh`:

```bash
CREATE DATABASE fusion_newservice;
GRANT ALL PRIVILEGES ON DATABASE fusion_newservice TO $POSTGRES_USER;
```

4. Expose port in `docker-compose.override.yml` if needed for debugging.

### Frontend (Next.js MFE)

1. Enable standalone output in `next.config.ts`:

```ts
output: 'standalone',
```

2. Create `Frontend/apps/newmfe/Dockerfile` (copy from `apps/shell/Dockerfile`)

3. Add to `docker-compose.yml`:

```yaml
frontend-newmfe:
  build:
    context: ./Frontend
    dockerfile: apps/newmfe/Dockerfile
  container_name: fusion-frontend-newmfe
  ports:
    - "3003:3003"
  networks:
    - fusion-net
```

## Troubleshooting

### Services not starting

```bash
# Check logs for the failing service
docker-compose logs identity

# Common issues:
# - Port already in use: change port in .env
# - Database not ready: wait for postgres health check
```

### Database connection issues

```bash
# Check postgres is healthy
docker-compose ps postgres

# PostgreSQL takes ~10-15s on first start
# Services wait via depends_on health check
```

### Frontend build failures

```bash
# Clean rebuild
docker-compose build --no-cache frontend-shell

# Common issues:
# - pnpm workspace resolution: ensure packages/ copied before install
# - Missing dependencies: check pnpm-lock.yaml is committed
```

### Line ending issues (Windows)

Shell scripts must use LF line endings. The `.gitattributes` file enforces this:

```
*.sh text eol=lf
```

If init scripts fail, re-clone or run:
```bash
git add --renormalize .
```
