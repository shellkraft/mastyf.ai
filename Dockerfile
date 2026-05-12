FROM node:20-alpine AS builder
WORKDIR /app

# Copy entire workspace + source for monorepo resolution
COPY . .

RUN corepack enable && pnpm install --frozen-lockfile

# Build sequentially to respect workspace dependency order
RUN cd packages/core && pnpm build
RUN cd packages/server && pnpm build
# Build root before cli — cli imports @mcp-guardian/server (root)
RUN npx tsc --project tsconfig.json
RUN cd packages/cli && pnpm build

FROM node:20-alpine
RUN addgroup -g 1001 -S appgroup && adduser -u 1001 -S appuser -G appgroup
RUN apk add --no-cache curl
WORKDIR /app
COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/package.json ./
COPY --from=builder /app/default-policy.yaml ./default-policy.yaml
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4000/ || exit 1
USER appuser
EXPOSE 4000 9090
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"
ENTRYPOINT ["node", "dist/cli.js", "proxy"]