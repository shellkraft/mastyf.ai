# MCP Guardian — Technical Overview

**Version:** 3.4.1  
**Package:** `@mcp-guardian/server` (npm)  
**Repository:** https://github.com/rudraneel93/mcp-guardian  
**Website:** https://mcp-guardian-cloud.vercel.app  

*Confidentiality: This document describes product architecture at a high level. It omits signing keys, internal threat research heuristics, and customer-specific configurations.*

---

## 1. Executive summary

MCP Guardian is a **governance proxy** for the Model Context Protocol (MCP). It sits between AI clients (Cursor, Claude Desktop, Cline, Windsurf, and others) and upstream MCP tool servers. Every `tools/call` request is evaluated against customer-controlled policy **before** reaching real infrastructure (filesystem, shells, APIs, databases).

The product delivers three outcomes in one install:

1. **Enforcement** — deterministic allow/block with explainable reasons  
2. **Observability** — full audit trail, cost/token accounting, live dashboard  
3. **Continuous improvement** — offline harness, Security Swarm red-teaming, LLM-assisted Threat Lab, and agentic analysis layers  

All capabilities ship in the open-source / npm distribution; there is no separate paid tier for core security features.

---

## 2. Problem and placement

| Without Guardian | With Guardian |
|------------------|---------------|
| IDE connects directly to MCP servers | IDE connects to Guardian-wrapped endpoints |
| Tool abuse is invisible or post-hoc | Every call is logged and policy-checked in real time |
| Policy changes require server forks | YAML policy hot-reloads without restart |
| No unified cost or block telemetry | SQLite/Postgres audit + dashboard + optional SIEM |

Guardian is the **control plane for agent tool access**—analogous to an API gateway for LLM tool calls, optimized for MCP JSON-RPC semantics.

---

## 3. System architecture

### 3.1 Runtime topology (typical)

A standard developer deployment runs **one Node.js process** (≥18) that hosts:

| Layer | Responsibility |
|-------|----------------|
| **Proxy** | Intercepts MCP JSON-RPC on stdio, HTTP, SSE, WebSocket, streamable HTTP |
| **Policy engine** | YAML rules, RBAC, rate limits, pattern matchers; hot-reload |
| **Agentic services** (optional) | Pre/post hooks, trust scoring, policy synthesis, threat prediction |
| **Dashboard API** | REST + WebSocket; serves static Next.js SPA |
| **Audit store** | SQLite (`better-sqlite3`, WAL mode) or PostgreSQL (fleet) |

**Upstream:** child-process MCP servers (stdio) or HTTP/SSE relays to remote MCP hosts.

**Clients:** AI assistants configured via `mcp-guardian onboard` to use Guardian as the MCP transport.

### 3.2 Tool-call governance pipeline

Blocked requests **never** reach upstream. The hot path is:

1. **Transport** receives `tools/call` JSON-RPC  
2. **Pre-forward guard** — payload size limits; optional agentic hooks (e.g. prompt-injection scan)  
3. **Policy evaluation** — `PolicyEngine.evaluateAsync` (YAML, rate limits, allowlists)  
4. **Semantic gate** (optional) — sync LLM/heuristic check on arguments  
5. **Forward** to upstream MCP server  
6. **Response gate** (optional) — DLP / streaming inspection on tool results  
7. **Audit** — async write to `call_records`; structured block events to SIEM exporters  

Rate-limit counters persist across policy hot-reload via an in-process shared store (Redis in multi-replica enterprise mode).

### 3.3 Offline and learning pipelines

These run **beside** the live proxy (not in the per-request hot path):

| Pipeline | Purpose |
|----------|---------|
| **Adversarial harness** | 800+ attack fixtures replayed against policy offline |
| **Security Swarm** | Automated red-team loop; bypass detection; reports under `reports/security-swarm/` |
| **Threat Lab** | Local LLM proposes corpus candidates; human review before merge |
| **Auto Threat Research** | Converts live blocks into validated `adv-*.json` fixtures (dedupe, rate caps) |

Outputs feed policy refinement and harness corpus growth; **no silent production policy changes**.

---

## 4. Main components

| Component | Location (repo) | Description |
|-----------|-----------------|-------------|
| **CLI** | `src/cli.ts` | `onboard`, `proxy`, `doctor`, policy test commands |
| **MCP server surface** | `src/index.ts` | MCP tools for automation and dashboard integration |
| **DI container** | `src/container.ts` | Boots policy, proxy, dashboard, agentic modules |
| **Stdio proxy** | `src/proxy/proxy-server.ts` | Default wrapped transport (`McpProxyServer`) |
| **Network proxies** | `src/proxy/http-*.ts`, `sse-*.ts`, `websocket-*.ts`, `streamable-http-*.ts` | Same governance on all MCP transports |
| **Pre-guard** | `src/proxy/tool-call-pre-guard.ts` | Payload caps + agentic bridge |
| **Policy** | `src/policy/policy-engine.ts`, `policy-watcher.ts`, `rate-limit-store.ts` | Rule evaluation and reload |
| **Semantic gates** | `src/proxy/proxy-post-policy-gates.ts` | Optional request/response LLM checks |
| **History DB** | `src/database/history-db.ts`, `audit-write-queue.ts` | Audit, cost, retention |
| **Dashboard server** | `src/utils/dashboard-server.ts` | REST API, auth, WebSocket push |
| **Dashboard SPA** | `deploy/dashboard-spa/` | Next.js — Protection, Activity, Agentic AI workspaces |
| **Agentic core** | `src/agentic/` | Hooks, scheduler, 10+ feature modules |
| **Security Swarm** | `security-swarm/` | Node orchestration for red-team steps |
| **Harness** | `adversarial-harness/` | Corpus and CI eval |
| **Plugin SDK** | `packages/plugin-sdk/` | Custom detectors and exporters |
| **Default policy** | `default-policy.yaml` | Shipped baseline (regex, schema, tool rules) |

---

## 5. Key technologies

| Category | Technology |
|----------|------------|
| **Language** | TypeScript 5.4+ (ES modules) |
| **Runtime** | Node.js ≥18 |
| **MCP** | `@modelcontextprotocol/sdk` ~1.25 |
| **Local DB** | SQLite via `better-sqlite3` (WAL, busy_timeout) |
| **Fleet DB** | PostgreSQL (`DB_TYPE=postgres`, optional PgBouncer) |
| **Dashboard UI** | Next.js (static export served by proxy process) |
| **Build** | `tsc`, Turborepo (monorepo), pnpm workspaces |
| **Auth (dashboard)** | Session/JWT patterns; optional Google OAuth on cloud deploy |
| **Enterprise cache** | Redis (rate limits, DPoP, circuit-breaker sync) |
| **Observability** | Prometheus metrics, structured logs, optional OpenTelemetry |
| **SIEM** | Pluggable exporters (`MCP_GUARDIAN_SIEM_ENABLED`) |
| **LLM (optional)** | OpenAI / Anthropic / compatible APIs; Ollama for Threat Lab |
| **CI** | GitHub Actions |

---

## 6. Deployment models

### 6.1 Developer / single-user (default)

```bash
npm install -g @mcp-guardian/server
mcp-guardian onboard          # wrap IDE MCP configs
mcp-guardian proxy --policy default-policy.yaml
# or from repo:
pnpm dashboard:proxy        # proxy + dashboard on :4000
```

| Setting | Default |
|---------|---------|
| Audit DB | `~/.mcp-guardian/history.db` (`MCP_GUARDIAN_DB_PATH`) |
| Dashboard | `http://localhost:4000` (`DASHBOARD_PORT`) |
| Policy | `default-policy.yaml` (`MCP_GUARDIAN_POLICY_PATH`) |

### 6.2 Team / CI

- Run `pnpm harness` for offline policy regression  
- Run `pnpm security-swarm` for bypass reports  
- Env: `MCP_GUARDIAN_DB_PATH`, `GUARDIAN_CI_BYPASS_LICENSE` (dev only where documented)  

### 6.3 Enterprise / multi-replica

Documented in `docs/ENTERPRISE_DEPLOYMENT.md` and Helm charts under `deploy/helm/`:

| Requirement | Notes |
|-------------|-------|
| `GUARDIAN_ENTERPRISE_MODE=true` | Multi-replica semantics |
| `REDIS_URL` | Distributed rate limits, session flow, shared cache |
| `DB_TYPE=postgres` + `DATABASE_URL` | HA audit store |
| Signed policy, four-eyes approval | Optional governance hardening |
| Semantic gates | Configurable fail-open/closed per risk tier |

Kubernetes Helm values: `deploy/helm/mcp-guardian/`. Multi-region notes: `docs/MULTI_REGION.md`.

### 6.4 Cloud marketing / docs site

Static site and docs hosted on Vercel (`mcp-guardian-cloud.vercel.app`). **Production MCP governance runs on customer infrastructure** (local proxy or customer K8s)—not as a mandatory SaaS middleman for tool traffic.

---

## 7. Security and privacy posture (summary)

| Topic | Approach |
|-------|----------|
| **Policy authority** | Customer YAML; hot-reload; optional signed policy in enterprise |
| **Data residency** | Audit DB stays on customer host by default |
| **Argument storage** | Optional field encryption (`GUARDIAN_DB_ENCRYPT_AUDIT_ARGS`) |
| **Threat mesh** | Anonymized signature sharing only; no raw tool payloads (see `docs/THREAT_MESH_PRIVACY.md`) |
| **Blocked calls** | Never forwarded upstream; logged with reason codes |
| **Supply chain** | Package/CVE scan; adversarial corpus + swarm bypass tracking |

*This document does not enumerate specific detection signatures or internal scoring weights.*

---

## 8. Integration and extension points

| Extension | Mechanism |
|-----------|-----------|
| Custom policy | YAML + `policy-watcher.ts` hot-reload |
| OPA / Rego | Optional `OPA_URL` overlay |
| Plugin SDK | Custom detector plugins and exporters |
| Agentic modules | Register in `container.ts`; hook via `proxy-integration.ts` |
| Attack corpus | Add `adversarial-harness/fixtures/custom-attacks/adv-*.json` |
| SIEM | Enable structured exporters and block/allow events |

---

## 9. Evaluation flow (recommended)

For technical or investor evaluation, focus on the **wrap → govern → observe** loop:

1. **Onboard** — `mcp-guardian onboard` rewrites IDE configs to Guardian-wrapped servers  
2. **Traffic** — normal IDE usage or `pnpm real-life:filesystem` smoke test  
3. **Proof** — dashboard shows allow/block with reasons; verify blocked calls did not reach upstream  
4. **Depth (optional)** — policy hot-reload, `pnpm harness`, Security Swarm / Threat Lab reports  

Primary demo URL: `http://localhost:4000` when running `pnpm dashboard:proxy`.

---

## 10. References

| Resource | URL / path |
|----------|------------|
| README (architecture diagrams) | https://github.com/rudraneel93/mcp-guardian#architecture |
| Architecture companion | `docs/ARCHITECTURE.md` |
| Agentic architecture | `docs/AGENTIC_ARCHITECTURE.md` |
| Threat Lab | `docs/THREAT_LAB.md` |
| Enterprise deployment | `docs/ENTERPRISE_DEPLOYMENT.md` |
| npm package | https://www.npmjs.com/package/@mcp-guardian/server |

---

*Document generated for external technical review. © MCP Guardian contributors. MIT License.*
