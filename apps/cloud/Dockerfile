FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/cloud/package.json ./apps/cloud/
RUN pnpm install --filter @mastyff-ai/cloud... --frozen-lockfile || pnpm install --filter @mastyff-ai/cloud...

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/cloud/node_modules ./apps/cloud/node_modules
COPY . .
WORKDIR /app/apps/cloud
RUN pnpm run build

FROM base AS runner
WORKDIR /app/apps/cloud
ENV NODE_ENV=production
ENV PORT=3001
COPY --from=builder /app/apps/cloud/.next ./.next
COPY --from=builder /app/apps/cloud/public ./public
COPY --from=builder /app/apps/cloud/package.json ./
COPY --from=builder /app/apps/cloud/next.config.ts ./
COPY --from=builder /app/apps/cloud/seeds ./seeds
COPY --from=builder /app/apps/cloud/db ./db
COPY --from=builder /app/apps/cloud/scripts ./scripts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/cloud/node_modules ./node_modules
EXPOSE 3001
CMD ["sh", "-c", "node scripts/migrate.mjs && pnpm start"]
