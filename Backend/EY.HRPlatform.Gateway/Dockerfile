# ==============================================================================
# EY.HRPlatform.Gateway — Multi-stage Dockerfile
# ==============================================================================
# Build:   docker build -f EY.HRPlatform.Gateway/Dockerfile -t gateway .
# Run:     docker run -p 5000:5000 gateway
# ==============================================================================

# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src

# Copy csproj files and restore (layer caching optimization)
COPY ["EY.HRPlatform.Gateway/EY.HRPlatform.Gateway.csproj", "EY.HRPlatform.Gateway/"]
COPY ["EY.HRPlatform.SharedKernel/EY.HRPlatform.SharedKernel.csproj", "EY.HRPlatform.SharedKernel/"]
RUN dotnet restore "EY.HRPlatform.Gateway/EY.HRPlatform.Gateway.csproj"

# Copy source and publish
COPY . .
WORKDIR /src/EY.HRPlatform.Gateway
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
ENV ASPNETCORE_URLS=http://+:5000
ENV ASPNETCORE_ENVIRONMENT=Docker
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

ENTRYPOINT ["dotnet", "EY.HRPlatform.Gateway.dll"]
