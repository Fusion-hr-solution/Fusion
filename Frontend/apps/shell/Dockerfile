# ==============================================================================
# Frontend Shell — Multi-stage Dockerfile
# ==============================================================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# Copy workspace config and install all dependencies
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ ./packages/
COPY apps/shell/package.json ./apps/shell/
RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# Copy everything from deps stage
COPY --from=deps /app .
# Copy source code (overwrites any placeholder files)
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter shell build

# Stage 3: Runtime
FROM node:20-alpine AS runtime
WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=build /app/apps/shell/.next/standalone ./
COPY --from=build /app/apps/shell/.next/static ./apps/shell/.next/static
COPY --from=build /app/apps/shell/public ./apps/shell/public

USER appuser

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
EXPOSE 3000

CMD ["node", "apps/shell/server.js"]
