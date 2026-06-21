# mastyf.ai

**Know which MCP servers are safe to trust — then protect them in production.**

[mastyf.ai](https://www.mastyf.ai) is a security platform for the Model Context Protocol (MCP). It scores npm MCP packages, hosts public trust badges, and provides a free cloud console for policy and fleet management. The same codebase also ships as **`@mastyf-ai/server`** on npm — a self-hosted MCP security proxy you can run on your own machine, in Docker, or on Kubernetes.

[![npm version](https://img.shields.io/npm/v/@mastyf-ai/server)](https://www.npmjs.com/package/@mastyf-ai/server)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

GitHub: [github.com/mastyf-ai/mastyf.ai](https://github.com/mastyf-ai/mastyf.ai)

---

## What mastyf.ai does

When you connect an AI assistant to an MCP server, that server can run tools on your behalf — read files, call APIs, execute shell commands, and more. mastyf.ai helps you answer two questions:

1. **Before you install:** Is this npm MCP package safe? What is its trust score?
2. **After you deploy:** How do I block risky tool calls, audit traffic, and manage policy across a team?

The **website** (`apps/cloud`) handles public scores, badges, and the cloud console. The **npm package** (`@mastyf-ai/server`, CLI command `mastyf-ai`) is the self-hosted engine that scans configs, proxies MCP traffic, and enforces YAML policy.

---

## Platform features (website)

These pages and APIs are served by the Next.js app in `apps/cloud`. The live deployment at [mastyf-ai-cloud-jet.vercel.app](https://mastyf-ai-cloud-jet.vercel.app) has been verified for the routes below.

### Home page (`/`)

The landing page explains the product and includes a **badge lookup widget**. Type any npm MCP package name (for example `@playwright/mcp`) and jump straight to its score page. Navigation links go to security scores, the cloud console, GitHub, and sign-in.

### Security scores directory (`/certified`)

This is the main public feature. You can:

- **Search any npm MCP package** — scores are computed on demand from npm metadata, CVE feeds, and static analysis. No prior registration is required.
- **See recently scored packages** — when a Postgres database is connected, past scores appear in a table with score, grade, scan tier, and date.
- **Understand the three steps:** look up → optional deep scan → embed a badge in your README.

**How static scoring works:** When you open a package page, mastyf.ai downloads the package from npm, inspects its manifest and dependencies, checks known CVEs, and runs security heuristics. The result is a **0–100 trust score** and a letter grade from **A+ to F**, plus a tier label (bronze, silver, gold, etc.).

Scores are cached in Postgres when available (24 hours for static scans, 7 days for live scans). Without a database, scoring still works — results are just not persisted in the directory table.

### Package score page (`/certified/<package>`)

Each package gets a dedicated page showing:

- **Score ring** with numeric score and letter grade
- **Scan tier badge** — `static` (npm-only analysis) or `live` (server was actually started and probed)
- **Score report panel** — plain-English breakdown of checks (CVE posture, secrets, tool definitions, supply chain signals, etc.)
- **Badge embed gallery** — copy-paste snippets for GitHub markdown, HTML, and direct SVG/JSON URLs
- **Deep scan button** — visible when deep scan is enabled (see below)
- **Maintainer attestation** — if a package owner published a signed score via `mastyf-ai certify publish`, that attestation can appear alongside computed scores (newer live scan wins over older attestation)

If the package does not exist on npm, you see a friendly “package not found” page instead of an error.

### Trust badges and Badge API

Badges are small SVG images you embed in README files, docs, or websites. They show the current trust score and grade for a package.

| Endpoint | What it returns |
|----------|-----------------|
| `GET /api/v1/badge/<package>` | SVG badge image |
| `GET /api/v1/badge/<package>?style=github` | GitHub-style flat badge |
| `GET /api/v1/badge/<package>/json` | Full JSON score payload |
| `GET /api/v1/badge/<package>?format=json` | Same JSON via query param |

**Example (verified on production):**

```bash
curl -s "https://mastyf-ai-cloud-jet.vercel.app/api/v1/badge/@playwright%2Fmcp/json"
```

Returns JSON with `score`, `grade`, `scanTier`, `checks`, `computedAt`, `badgeUrl`, and `verifyUrl`.

SVG responses support `ETag` caching — clients re-fetch only when the score changes.

### Deep scan (live probe)

Static scoring analyzes the published npm tarball. **Deep scan** goes further: it starts the MCP server locally via `npx`, connects over stdio, lists tools, and probes them for runtime security signals. The result is a **live** scan tier with a richer score.

Deep scan is **enabled automatically** when you run the cloud app locally (`localhost:3001` or `NODE_ENV=development`). On production Vercel it returns **501** unless you explicitly set `MASTYF_AI_ENABLE_DEEP_SCAN=true` (subprocess support is required).

Trigger via the button on a package page, or:

```bash
curl -X POST "http://localhost:3001/api/v1/deep-scan/@playwright%2Fmcp"
```

Set `MASTYF_AI_DISABLE_DEEP_SCAN=true` to turn it off everywhere.

### Cloud console (`/dashboard`)

Sign in at `/login` to access your organization's cloud console. The console is **free** and does not require running the self-hosted proxy.

| Page | What you can do |
|------|-----------------|
| **Overview** (`/dashboard`) | See your tenant ID, copy environment variables for API automation, quick links |
| **Policy** (`/dashboard/policy`) | Edit YAML security policy in a web editor; download or publish changes |
| **Fleet** (`/dashboard/fleet`) | View self-hosted proxy instances that send heartbeats; threat graph for your org |
| **Settings** (`/dashboard/settings`) | Create and rotate API keys, manage account, sign out |
| **Connect** (`/dashboard/connect`) | Optional setup to link a self-hosted `mastyf-ai` proxy to your cloud tenant for policy sync and SSO |

**Local dev sign-in:** Set `AUTH_DEV_LOGIN=true` in `apps/cloud/.env.local` to sign in without OAuth.

**Requires Postgres:** Auth, organizations, API keys, policy storage, fleet heartbeats, and the score cache directory all need `DATABASE_URL` pointing to a PostgreSQL database (local or Neon).

### MCP Ecosystem Observatory (`/observatory`)

A public dashboard of anonymized fleet telemetry: adoption score, threat heat index, average block rate, servers tracked, and top threat classes (prompt injection, credential exfiltration, shell obfuscation, etc.). Also lists certification-backed reputation entries when the database is available.

API: `GET /api/v1/observatory/snapshot` — returns the same metrics as JSON.

### Public benchmark leaderboard (`/benchmarks`)

Community-submitted proxy profiles ranked by block rate and false-positive rate. Feeds aggregated data into the observatory. Submit via `POST /api/v1/benchmarks/submit` (requires auth/API key).

### Legal pages

- `/terms` — Terms of service
- `/privacy` — Privacy policy

---

## Self-hosted features (`mastyf-ai` CLI)

Install globally from npm:

```bash
npm install -g @mastyf-ai/server
```

The CLI command is **`mastyf-ai`**. Main commands:

| Command | Purpose |
|---------|---------|
| `mastyf-ai scan --all` | Scan all discoverable MCP config files for CVEs, secrets, and risky tools |
| `mastyf-ai start` | Start the MCP proxy and local web dashboard (default `http://localhost:4000`) |
| `mastyf-ai onboard --apply` | Detect IDE MCP servers, wrap them with audit policy, save status |
| `mastyf-ai wrap` | Wrap Cline/Cursor/Claude MCP configs with the proxy |
| `mastyf-ai proxy --policy ./policy.yaml` | Run proxy with YAML policy enforcement |
| `mastyf-ai audit` | Audit token costs across MCP servers |
| `mastyf-ai health` | Health-check configured MCP servers |
| `mastyf-ai report` | Generate a full security/cost/health report |
| `mastyf-ai certify publish` | Scan a server, compute trust score, publish badge to mastyf.ai Cloud |
| `mastyf-ai fleet` | Fleet-wide observability across replicas |
| `mastyf-ai doctor` | Quick diagnostics for DB path, policy, and env |
| `mastyf-ai tui` | Interactive terminal dashboard |

### How the proxy works

AI clients send MCP tool calls through the **mastyf.ai proxy**. The proxy inspects each call against policy and scanners before forwarding to the upstream MCP server.

```
AI client  →  mastyf-ai proxy  →  upstream MCP server
                    │
                    ├─ Policy (YAML, hot-reload)
                    ├─ CVE / secrets / injection scans
                    ├─ Cost & health metrics
                    └─ Dashboard + alerts
```

**Detection layers:** regex patterns, JSON schema checks, shell AST analysis, optional LLM semantic review, response DLP, and a YAML policy engine with rate limits and RBAC.

**Transports:** stdio, SSE, WebSocket, streamable HTTP, multi-tenant gateway.

**Control plane / data plane:** Node.js compiles policies; Go (`apps/proxy-core/`) can run a high-performance data plane.

### Link proxy to cloud (optional)

Point your self-hosted proxy at mastyf.ai Cloud to pull policy and register fleet heartbeats:

```bash
export MASTYF_AI_CONTROL_PLANE_URL=https://www.mastyf.ai
export MASTYF_AI_TENANT_ID=your-org-slug
export MASTYF_AI_CLOUD_API_KEY=your-api-key
```

Copy full env vars from **Dashboard → Connect** after sign-in.

### Publish a maintainer score

Package maintainers can publish a signed attestation:

```bash
mastyf-ai certify publish \
  --server my-server \
  --package @scope/my-mcp \
  --pkg-version 1.0.0 \
  --cloud-url https://www.mastyf.ai
```

---

## Cloud API reference (summary)

Public (no auth):

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/badge/<package>` | SVG or JSON trust badge |
| GET | `/api/v1/observatory/snapshot` | Observatory metrics JSON |
| GET | `/api/v1/certifications` | Public certification registry |
| GET | `/api/v1/certifications/verify/<id>` | Verify a certification |
| POST | `/api/v1/deep-scan/<package>` | Run live deep scan (local dev only by default) |

Authenticated (Bearer API key or session):

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/policy` | Fetch tenant policy YAML |
| POST | `/api/v1/policy/publish` | Publish policy changes |
| GET | `/api/v1/policy/rules` | List policy rules |
| POST | `/api/v1/instances/heartbeat` | Register proxy instance heartbeat |
| GET | `/api/v1/fleet/threat-graph` | Fleet threat graph data |
| GET | `/api/v1/fleet/federated-radar` | Federated threat radar |
| POST | `/api/v1/keys/rotate` | Rotate API keys |
| GET | `/api/v1/org` | Organization details |
| GET | `/api/v1/license` | Cloud org API key validation (401 without key) |
| POST | `/api/v1/benchmarks/submit` | Submit benchmark profile |
| POST | `/api/v1/mtx/contribute` | Contribute to threat matrix |
| GET | `/api/v1/mtx/catalog` | Threat matrix catalog |
| POST | `/api/v1/reputation/query` | Reputation query |

---

## Quick start — website (local dev)

```bash
git clone https://github.com/mastyf-ai/mastyf.ai.git
cd mastyf.ai
pnpm install

cp apps/cloud/.env.example apps/cloud/.env.local
# Set DATABASE_URL to Postgres (local or Neon)
# Set AUTH_DEV_LOGIN=true for easy local sign-in

pnpm cloud:dev
```

Open **http://localhost:3001**

| URL | Feature |
|-----|---------|
| `/` | Landing + badge lookup |
| `/certified` | Security scores directory |
| `/certified/@playwright/mcp` | Example package score page |
| `/login` | Sign in |
| `/dashboard` | Cloud console (after sign-in) |
| `/observatory` | Ecosystem observatory |
| `/benchmarks` | Benchmark leaderboard |

More deploy docs: [apps/cloud/docs/VERCEL_DEPLOY.md](apps/cloud/docs/VERCEL_DEPLOY.md) · [apps/cloud/docs/CUSTOM_DOMAIN.md](apps/cloud/docs/CUSTOM_DOMAIN.md)

---

## Quick start — CLI (npm)

```bash
npm install -g @mastyf-ai/server

# Scan all MCP servers in your IDE configs
mastyf-ai scan --all

# Start proxy + local dashboard
mastyf-ai onboard --apply
mastyf-ai start

# Or run with explicit policy
mastyf-ai proxy --policy ./policy.yaml --blocking-mode block
```

---

## Deploy mastyf.ai to Vercel

```bash
export VERCEL_TOKEN="..."           # vercel.com/account/tokens
export DATABASE_URL="postgresql://..."  # Neon — not localhost

pnpm cloud:migrate:prod
pnpm cloud:deploy-now
```

Default URL: **https://mastyf-ai-cloud-jet.vercel.app**  
Custom domain (`www.mastyf.ai`): see [apps/cloud/docs/CUSTOM_DOMAIN.md](apps/cloud/docs/CUSTOM_DOMAIN.md)

Verify after deploy:

```bash
APP_URL=https://mastyf-ai-cloud-jet.vercel.app pnpm cloud:verify-prod
```

---

## Production deployment (self-hosted proxy)

### Docker

```bash
docker run -v $(pwd)/mcp.json:/etc/mastyf-ai/config.json \
  -v $(pwd)/policy.yaml:/etc/mastyf-ai/policy.yaml \
  ghcr.io/mastyf-ai/mastyf-ai:latest \
  proxy --config /etc/mastyf-ai/config.json --policy /etc/mastyf-ai/policy.yaml
```

### Kubernetes (Helm)

```bash
helm repo add mastyf-ai https://mastyf-ai.github.io/mastyf-ai
helm install mastyf-ai mastyf-ai/mastyf-ai
```

---

## Repo layout

```
mastyf.ai/
├── apps/cloud/           # Next.js — scores, badges, cloud console
├── apps/proxy-core/      # Go data-plane proxy
├── packages/             # Shared npm packages (@mastyf-ai/core, etc.)
├── src/                  # Main proxy source (scanners, agentic AI, CLI)
├── deploy/               # Docker, Helm, embedded dashboard SPA
├── security-swarm/       # Autonomous red-team agents
├── adversarial-harness/  # Attack corpus & harness
└── scripts/              # Deploy, migrate, benchmarks
```

---

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck

pnpm cloud:dev          # Website on :3001
pnpm cloud:build
pnpm cloud:test         # Cloud unit tests (25 tests)

pnpm eval               # Corpus evaluation
pnpm security-swarm:fast
```

---

## Verified behavior (June 2026)

Tested against production deployment `https://mastyf-ai-cloud-jet.vercel.app`:

| Check | Result |
|-------|--------|
| `/`, `/certified`, `/certified/@playwright/mcp` | 200 OK |
| `/login`, `/benchmarks`, `/observatory`, `/terms`, `/privacy` | 200 OK |
| `/dashboard` (unsigned) | 307 redirect to login |
| `GET /api/v1/badge/@playwright/mcp/json` | 200 — score 58, grade C, static scan |
| `GET /api/v1/badge/@playwright/mcp?style=github` | 200 SVG |
| `GET /api/v1/observatory/snapshot` | 200 JSON |
| `GET /api/v1/license` (no key) | 401 |
| `POST /api/v1/deep-scan/...` on Vercel | 501 (expected — enable locally) |
| `pnpm cloud:test` | 25/25 passed |

---

## Common commands

| Command | What it does |
|---------|----------------|
| `pnpm cloud:dev` | Run mastyf.ai website locally on :3001 |
| `pnpm cloud:deploy-now` | Deploy cloud app to Vercel |
| `mastyf-ai scan --all` | Scan MCP configs for issues |
| `mastyf-ai start` | Start protected proxy + dashboard |
| `mastyf-ai certify publish ...` | Publish maintainer trust score |

---

## License

MIT — see [LICENSE](LICENSE).

---

## Links

- **Website:** [mastyf.ai](https://www.mastyf.ai)
- **npm:** [@mastyf-ai/server](https://www.npmjs.com/package/@mastyf-ai/server)
- **GitHub:** [mastyf-ai/mastyf.ai](https://github.com/mastyf-ai/mastyf.ai)
- **Deploy docs:** [apps/cloud/docs/VERCEL_DEPLOY.md](apps/cloud/docs/VERCEL_DEPLOY.md)
