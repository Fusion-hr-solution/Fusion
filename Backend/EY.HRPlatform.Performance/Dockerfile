# ==============================================================================
# EY.HRPlatform.Performance — Multi-stage Dockerfile
# ==============================================================================
# Build:   docker build -f EY.HRPlatform.Performance/Dockerfile -t performance .
# Run:     docker run -p 5401:5401 -e ConnectionStrings__PerformanceDb="..." performance
# ==============================================================================

# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src

# Copy csproj files and restore (layer caching optimization)
COPY ["EY.HRPlatform.Performance/EY.HRPlatform.Performance.csproj", "EY.HRPlatform.Performance/"]
RUN dotnet restore "EY.HRPlatform.Performance/EY.HRPlatform.Performance.csproj"

# Copy source and publish
COPY . .
WORKDIR /src/EY.HRPlatform.Performance
RUN dotnet publish -c Release -o /app/publish --no-restore

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS runtime
WORKDIR /app

# Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Copy published output
COPY --from=build /app/publish .

# Configure runtime
ENV ASPNETCORE_URLS=http://+:5401
ENV ASPNETCORE_ENVIRONMENT=Docker
EXPOSE 5401

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5401/health/live || exit 1

ENTRYPOINT ["dotnet", "EY.HRPlatform.Performance.dll"]
