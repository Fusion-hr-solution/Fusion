# ==============================================================================
# EY.HRPlatform.CoreHR — Multi-stage Dockerfile
# ==============================================================================
# Build:   docker build -f EY.HRPlatform.CoreHR/Dockerfile -t corehr .
# Run:     docker run -p 5301:5301 -e ConnectionStrings__CoreHRDb="..." corehr
# ==============================================================================

# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src

# Copy csproj files and restore (layer caching optimization)
COPY ["EY.HRPlatform.CoreHR/EY.HRPlatform.CoreHR.csproj", "EY.HRPlatform.CoreHR/"]
COPY ["EY.HRPlatform.SharedKernel/EY.HRPlatform.SharedKernel.csproj", "EY.HRPlatform.SharedKernel/"]
RUN dotnet restore "EY.HRPlatform.CoreHR/EY.HRPlatform.CoreHR.csproj"

# Copy source and publish
COPY . .
WORKDIR /src/EY.HRPlatform.CoreHR
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
ENV ASPNETCORE_URLS=http://+:5301
ENV ASPNETCORE_ENVIRONMENT=Docker
EXPOSE 5301

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5301/health/live || exit 1

ENTRYPOINT ["dotnet", "EY.HRPlatform.CoreHR.dll"]
