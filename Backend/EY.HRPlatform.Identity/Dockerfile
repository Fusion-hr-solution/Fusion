# ==============================================================================
# EY.HRPlatform.Identity — Multi-stage Dockerfile
# ==============================================================================
# Build:   docker build -f EY.HRPlatform.Identity/Dockerfile -t identity .
# Run:     docker run -p 5101:5101 -e ConnectionStrings__IdentityDb="..." identity
# ==============================================================================

# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:10.0-preview-alpine AS build
WORKDIR /src

# Copy csproj files and restore (layer caching optimization)
COPY ["EY.HRPlatform.Identity/EY.HRPlatform.Identity.csproj", "EY.HRPlatform.Identity/"]
COPY ["EY.HRPlatform.SharedKernel/EY.HRPlatform.SharedKernel.csproj", "EY.HRPlatform.SharedKernel/"]
RUN dotnet restore "EY.HRPlatform.Identity/EY.HRPlatform.Identity.csproj"

# Copy source and publish
COPY . .
WORKDIR /src/EY.HRPlatform.Identity
RUN dotnet publish -c Release -o /app/publish --no-restore

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview-alpine AS runtime
WORKDIR /app

# Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Copy published output
COPY --from=build /app/publish .

# Configure runtime
ENV ASPNETCORE_URLS=http://+:5101
ENV ASPNETCORE_ENVIRONMENT=Docker
EXPOSE 5101

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5101/health || exit 1

ENTRYPOINT ["dotnet", "EY.HRPlatform.Identity.dll"]
