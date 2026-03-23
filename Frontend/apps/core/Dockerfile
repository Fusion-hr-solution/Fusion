# ==============================================================================
# Frontend Core MFE — Multi-stage Dockerfile
# ==============================================================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ ./packages/
COPY apps/core/package.json ./apps/core/
RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/core/node_modules ./apps/core/node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter core build

# Stage 3: Runtime
FROM node:20-alpine AS runtime
WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=build /app/apps/core/.next/standalone ./
COPY --from=build /app/apps/core/.next/static ./apps/core/.next/static
COPY --from=build /app/apps/core/public ./apps/core/public

USER appuser

ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME="0.0.0.0"
EXPOSE 3002

CMD ["node", "apps/core/server.js"]
