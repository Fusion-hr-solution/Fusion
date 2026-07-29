FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src

COPY ["EY.HRPlatform.Performance/EY.HRPlatform.Performance.csproj", "EY.HRPlatform.Performance/"]
RUN dotnet restore "EY.HRPlatform.Performance/EY.HRPlatform.Performance.csproj"

COPY . .
WORKDIR /src/EY.HRPlatform.Performance
RUN dotnet publish -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS runtime
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:5401
ENV ASPNETCORE_ENVIRONMENT=Docker
EXPOSE 5401
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 CMD wget --no-verbose --tries=1 --spider http://localhost:5401/health/live || exit 1
ENTRYPOINT ["dotnet", "EY.HRPlatform.Performance.dll"]
