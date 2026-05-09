FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ dist/

# Run as an MCP server (stdio) — responds to initialize, tools/list, tools/call
# This is what Glama/GitHub/registry directories expect for introspection checks.
# For proxy mode, override the entrypoint: docker run ... mcp-guardian proxy --config /config.json
ENTRYPOINT ["node", "dist/index.js"]
