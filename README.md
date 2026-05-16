# MCP Guardian

**Runtime security, cost governance, and health monitoring proxy for MCP infrastructure.**

[![npm version](https://img.shields.io/npm/v/@mcp-guardian/server)](https://www.npmjs.com/package/@mcp-guardian/server)
[![npm downloads](https://img.shields.io/npm/dm/@mcp-guardian/server)](https://www.npmjs.com/package/@mcp-guardian/server)
[![mcp-guardian MCP server](https://glama.ai/mcp/servers/rudraneel93/mcp-guardian/badges/score.svg)](https://glama.ai/mcp/servers/rudraneel93/mcp-guardian)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![MCP SDK](https://img.shields.io/badge/MCP_SDK-1.25-green)](https://github.com/modelcontextprotocol/typescript-sdk)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)
[![CI](https://github.com/rudraneel93/mcp-guardian/actions/workflows/ci.yml/badge.svg)](https://github.com/rudraneel93/mcp-guardian/actions/workflows/ci.yml)

MCP Guardian sits between AI agents and MCP servers, enforcing **active security policies**, tracking **real token costs**, monitoring **server health**, and providing **enterprise observability** — all through a YAML-configurable engine with hot-reload.

It works as a **transparent stdio proxy** (real-time enforcement for Cline, Cursor, Claude Code), a **standalone CLI**, an **interactive TUI**, an **MCP audit server** (agents can self-scan), and a **pnpm monorepo** — install only what you need.

**Version 2.6.6** hardens integration tests and DPoP replay across replicas (`REDIS_URL`). **2.6.5** improves long-running IDE setups: metrics dispose on shutdown, SQLite `SQLITE_BUSY` retry + WAL, and Remote SSH path mapping ([REMOTE_SSH.md](docs/REMOTE_SSH.md), [DEVCONTAINERS.md](docs/DEVCONTAINERS.md)). **2.6.4** fixes OPA-over-YAML precedence, non-blocking policy hot-reload, and an experimental detector plugin registry ([EXTENSIBILITY.md](docs/EXTENSIBILITY.md)). **2.6.3** adds native Windows PowerShell proxy wrapping. **2.5.3** hardens production defaults (CVE gate opt-in, dashboard auth fail-closed). **2.5.0** added `mcp-guardian wrap`, Docker Compose, PostgreSQL/Redis HA paths, and Helm hardening.

> **Experimental vs shipped (honest)**  
> **Shipped:** stdio proxy, YAML policy + semantic guards, OPA block precedence, dashboard auth (fail-closed), cost/token accounting, TUI, Redis/Postgres HA (single-region), Windows `guardian-proxy.ps1`, CVE scan (block is opt-in).  
> **Experimental / partial:** detector plugins (`GUARDIAN_PLUGINS_ENABLED`), AI learning (batch + block-triggered — not per-attack instant ML), async LLM semantic audit, browser SPA (API + WebSocket only; use TUI for live ops).  
> **Not yet:** multi-region active-active, fleet-wide TUI aggregation, full detector SDK (v3.0), MSI installer (v2.7 roadmap).

---

## Table of Contents

- [Quick Start](#quick-start)
- [Real-World Integration (Cline, Cursor, Claude Code)](#real-world-integration-cline-cursor-claude-code)
  - [Windows (native PowerShell)](#windows-native-powershell)
- [Two Operating Modes](#two-operating-modes)
- [Features](#features)
- [Installation](#installation)
- [CLI Reference](#cli-reference)
- [Policy Engine & Rollout](#policy-engine--rollout)
- [Interactive TUI](#interactive-tui)
- [Docker Compose](#docker-compose)
- [Kubernetes (Helm)](#kubernetes-helm)
- [Environment Variables](#environment-variables)
- [Production Checklist](#production-checklist)
- [Architecture](#architecture)
- [Development](#development)
- [FAQ](#faq)
- [Roadmap](#roadmap)
- [License](#license)

---

## Quick Start

```bash
# Install globally
npm install -g @mcp-guardian/server

# Scan all discoverable MCP configs (Cline, Cursor, Claude Desktop, Windsurf)
mcp-guardian scan --all

# Wrap IDE MCP servers for live proxy (audit mode first — safe rollout)
cd /path/to/mcp-guardian && npm run build
mcp-guardian wrap --client cline --policy policy-audit.yaml --apply

# Restart VS Code / reload MCP, then use Cline normally — traffic is proxied

# Interactive terminal dashboard
mcp-guardian tui

# Full report
mcp-guardian report --all --format markdown --output guardian-report.md
```

**Docker reference stack** (dashboard + Redis + proxy):

```bash
docker compose up --build
# Dashboard: http://localhost:4000  |  Metrics: http://localhost:9090/metrics
```

---

## Real-World Integration (Cline, Cursor, Claude Code)

AI clients spawn **one child process per MCP server** and speak JSON-RPC over **stdio**. MCP Guardian becomes that process: the IDE talks to Guardian; Guardian enforces policy and spawns the real upstream server as a child.

```
Cline / Cursor / Claude Code
        │  stdio JSON-RPC
        ▼
  scripts/guardian-proxy.sh  →  node dist/cli.js proxy
        │  policy + ~/.mcp-guardian/history.db
        ▼
  Real MCP server (npx @modelcontextprotocol/…)
```

### Critical rule: one Guardian process per MCP server

Wrap **each** server entry individually. Do not point the whole client at one proxy managing five backends (stdin routing is per-process).

| Client | Config path (macOS) |
|--------|---------------------|
| Cline (VS Code) | `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` |
| Cursor / Claude Code | `~/.cursor/mcp.json` |
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |

### One-command wrap

```bash
# Generate guardian-configs/<server>.json + example patched JSON
mcp-guardian wrap --client cline --policy policy-audit.yaml

# Patch live client config (creates timestamped .bak backup)
mcp-guardian wrap --client cline --policy policy-audit.yaml --apply

# Cursor / Claude Code
mcp-guardian wrap --client cursor --policy policy-warn.yaml --apply
```

**What wrap does:**

1. Reads your client MCP JSON
2. Writes upstream definitions to `guardian-configs/<server>.json` (one server each)
3. Replaces each entry’s `command` with `scripts/guardian-proxy.sh` and `--config` / `--policy` args
4. Skips `mcp-guardian` meta-server entries by default
5. Writes `examples/<config>.wrapped.json` for review

### Manual wrap (single server)

`guardian-configs/github.json` holds the **upstream** definition. Client entry:

```json
"github": {
  "command": "/absolute/path/mcp-guardian/scripts/guardian-proxy.sh",
  "args": [
    "--config", "/absolute/path/mcp-guardian/guardian-configs/github.json",
    "--policy", "/absolute/path/mcp-guardian/policy-audit.yaml"
  ],
  "transport": "stdio"
}
```

Use **absolute paths** — Cline’s working directory is unpredictable.

**Cline `env` note:** Cline often does not pass `env` from MCP JSON. Keep secrets in `guardian-configs/*.json`; use `guardian-proxy.sh` for `MCP_GUARDIAN_DB_PATH`, dashboard, and metrics env vars.

### Windows (native PowerShell)

On **win32**, `mcp-guardian wrap` uses `guardian-proxy.ps1` at the repo root and launches it via `powershell.exe -File` so paths like `C:\Users\John Doe\mcp-guardian` work. **WSL2** remains fully supported.

```powershell
pnpm build
mcp-guardian wrap --client cursor --policy policy-audit.yaml --apply
```

See **[docs/WINDOWS.md](docs/WINDOWS.md)** for Cursor example `mcp.json`, better-sqlite3 prebuild notes, and MSI roadmap (v2.7).

### Policy rollout (production-safe)

| Phase | File | Behavior |
|-------|------|----------|
| 1 — observe | `policy-audit.yaml` | Log decisions, no blocks |
| 2 — alert | `policy-warn.yaml` | Flag violations, still forward |
| 3 — enforce | `default-policy.yaml` | Active block |

```bash
mcp-guardian proxy --policy default-policy.yaml --dry-run   # simulate against history DB
mcp-guardian wrap --client cline --policy default-policy.yaml --apply
```

Full guide: **[docs/REAL_WORLD_INTEGRATION.md](docs/REAL_WORLD_INTEGRATION.md)**

Verify integration: `./scripts/verify-live-integration.sh`

---

## Two Operating Modes

| Mode | How | What it does |
|------|-----|--------------|
| **Proxy** | `wrap` / `guardian-proxy.sh` / `mcp-guardian proxy` | Intercepts every `tools/call` for wrapped servers — **use this for Cline** |
| **MCP audit server** | `"command": "npx", "args": ["-y", "@mcp-guardian/server"]` | Agent can call `scan_security`, `audit_costs`, etc. — does **not** protect other MCP servers |

---

## Features

### Security & policy
- **Fail-closed production default** — `default-policy.yaml` sets `default_action: block` (tools not on the allowlist are blocked). Onboarding uses `policy-demo.yaml` (`default_action: pass`, `mode: audit`) — not for production.
- **Semantic guards** (sync, before YAML rules) — path guard (`GUARDIAN_WORKSPACE` / prefixes), SQL exfil patterns, GitHub write-tool deny, PowerShell guard, prompt-injection in tool **arguments** (`semantic-guards.ts`)
- **Unicode / TR39** — `unicode_strict: true` loads `assets/confusables.txt` and folds confusables before regex (disable for literal Unicode in i18n teams)
- **Three-layer detection** — Regex → schema/shell tokenizer → optional async LLM semantic audit (not on the hot path)
- **YAML policy engine** — Allow/deny lists, regex, rate limits, token budgets, RBAC, argument field patterns
- **Hot-reload** — File watcher builds pending engine off-thread, atomic swap (no “reload in progress” blocks)
- **OPA/Rego precedence** — OPA **block** > YAML > `default_action`; OPA unavailable falls through to YAML ([POLICY.md](docs/POLICY.md))
- **`mcp-guardian policy test`** — CLI playground for one `tools/call` without starting the proxy
- **CVE gate (opt-in)** — `GUARDIAN_BLOCK_ON_CVE=false` by default; when `true`, blocks on scan severity (`GUARDIAN_CVE_BLOCK_SEVERITY`, default `CRITICAL`)
- **Secret / entropy DLP** — 50+ secret patterns, Shannon entropy in `block` mode (`GUARDIAN_PROXY_ENTROPY`)
- **Response inspection** — Prompt injection and exfiltration in tool **responses**
- **Experimental detector plugins** — `GUARDIAN_PLUGINS_ENABLED=true`, optional `GUARDIAN_PLUGIN_PATH`; see [EXTENSIBILITY.md](docs/EXTENSIBILITY.md) (full SDK v3.0 planned)

### Authentication & dashboard
- **Dashboard auth fail-closed** — When `DASHBOARD_ENABLED=true`, API requests are rejected unless `DASHBOARD_API_KEY` or `DASHBOARD_JWT_SECRET` is set. `DASHBOARD_AUTH_DISABLED=true` is for **local dev only** — do not expose to a network.
- **CSRF** — Double-submit cookie + `X-CSRF-Token` + Origin/Referer on mutating routes (skipped when auth disabled)
- **Session regeneration** — Successful login issues a fresh session token (`jti`) and revokes the prior cookie (session fixation mitigation)
- **OAuth 2.1 / OIDC** — JWT validation with algorithm pinning, audience/issuer checks (proxy path)
- **DPoP (RFC 9449)** — Sender-constrained tokens; **`jti` replay cache** rejects reused proof nonces (`src/auth/dpop.ts`)
- **RBAC** — Scope and client-ID rules in policy YAML
- **mTLS** — Mutual TLS for proxy ↔ upstream ([MTLS.md](docs/MTLS.md))

### AI learning (honest scope)
- **What it is** — Batch learning cycles plus **block-triggered** debounced runs (`GUARDIAN_AI_BLOCK_DEBOUNCE_MS`) after repeated policy blocks. It is **not** per-attack instant ML on every call.
- **Anti-poisoning** — Label quorum: `GUARDIAN_AI_MIN_DISTINCT_LABELERS` (default 2) or `GUARDIAN_AI_MIN_TOTAL_LABELS` (default 10); admin label weights; drift detection freezes auto threshold tuning until `GUARDIAN_AI_DRIFT_OVERRIDE=true`
- **Rollback** — `mcp-guardian ai rollback` and `POST /api/ai/rollback` restore the last learning snapshot; auto-rollback if precision proxy drops >10%
- **Human accept → policy** — TUI (`a` accept) or dashboard accept writes suggested rules to policy YAML (auto-apply off unless `GUARDIAN_AI_AUTO_APPLY=true`)
- **Async semantic audit** — Post-hoc LLM queue when `GUARDIAN_LLM_ENABLED` + `GUARDIAN_SEMANTIC_ASYNC` (default on); sync path stays regex + semantic guards (&lt;50ms target)

### Cost governance
- **Provider-aware token counting** — OpenAI via `tiktoken`; Anthropic via optional `@anthropic-ai/tokenizer` or chars÷3.5; prefers API `usage` when present (`tokenSource: api | estimated`)
- **Multimodal** — Image tokens `(width × height) / 750` added to tool-call estimates
- **Live pricing** — litellm-backed model costs (USD only)
- **Per-tool breakdown** — Tokens, duration, USD for every intercepted call — see [docs/COST_GOVERNANCE.md](docs/COST_GOVERNANCE.md)

### Health & Observability
- **Live JSON-RPC probes** — Latency, success rate, tool count
- **Circuit breaker** — CLOSED / OPEN / HALF_OPEN
- **Prometheus** — `/metrics`, `/healthz`, `/readyz` on port 9090
- **Web dashboard** — REST + WebSocket API on port 4000 (browser SPA not shipped — use TUI for live ops)
- **Interactive TUI** — Terminal dashboard (security, cost, health, AI, audit); **primary live-ops UI in v2.5.x**
- **OpenTelemetry** — OTLP tracing
- **SIEM hooks** — Structured JSON (`policy_decision`, `tool_blocked`) via `MCP_GUARDIAN_SIEM_*`
- **Webhook alerting** — Slack/Discord for policy blocks

### HA & scale
- **PgBouncer required** — For **>50 replicas** or any multi-replica K8s with `DB_TYPE=postgres`; direct `:5432` exhausts `max_connections` under load. Set `GUARDIAN_REQUIRE_PGBOUNCER=true` to fail startup without a pooler URL. See [docs/SCALE_AND_RESILIENCE.md](docs/SCALE_AND_RESILIENCE.md)
- **No multi-region active-active yet** — Redis locks assume &lt;80ms RTT; deploy single-region Redis + AZ spread only
- **PostgreSQL backend** — `DB_TYPE=postgres` + `DATABASE_URL` for shared audit store
- **Redis** — `REDIS_URL` for multi-replica rate limits and sessions (`GUARDIAN_STRICT_MODE`)

### IDE, remote & long-running dev
- **SQLite WAL + busy retry** — Shared `MCP_GUARDIAN_DB_PATH` between proxy and TUI; `persistCallRecord` retries `SQLITE_BUSY` (3× backoff, `busy_timeout=5000`)
- **Metrics lifecycle** — `shutdownMetrics()` on proxy/TUI/dashboard exit (clears maintenance intervals, closes `:9090`)
- **Remote SSH path map** — `GUARDIAN_REMOTE_SSH=true` + `GUARDIAN_REMOTE_PATH_MAP` translates local IDE paths for path-guard ([REMOTE_SSH.md](docs/REMOTE_SSH.md))
- **Dev containers** — Bind-mount the same `history.db`; see [DEVCONTAINERS.md](docs/DEVCONTAINERS.md)

### Enterprise (v2.5+)
- **Tenant isolation** — `GUARDIAN_TENANT_ID`, admin API routes on dashboard
- **Policy audit trail** — `POLICY_AUDIT_ENABLED` JSONL change log
- **Compliance pack** — [docs/COMPLIANCE.md](docs/COMPLIANCE.md), [docs/PEN_TEST_SCOPE.md](docs/PEN_TEST_SCOPE.md)
- **Helm chart** — Redis subchart, ServiceMonitor, ExternalSecrets, PDB, backup CronJob
- **Docker Compose** — Guardian + Redis reference stack
- **Supply chain** — `better-sqlite3` **12.10+** (bundled SQLite 3.53.x), `jose` **6.x**, CI `pnpm audit --audit-level=high`, CycloneDX SBOM, cosign on GHCR — [SUPPLY_CHAIN.md](docs/SUPPLY_CHAIN.md)

### Architecture
- **pnpm monorepo** — `packages/core`, `packages/cli`, `packages/server`, root `src/`
- **better-sqlite3 12.10+** — WAL mode, primary writer + read-only TUI observers on the same file, migrations, 30-day purge
- **Pluggable secrets** — env, HashiCorp Vault, AWS Secrets Manager
- **Graceful shutdown** — WAL checkpoint, connection flush

### Testing
- **386+ tests** — unit, integration, E2E proxy, fuzz, RBAC/OAuth/DPoP, policy precedence, plugins
- **Red-team corpus** — precision/recall on poisoned payloads
- **Coverage gates** — 70% lines in CI

---

## Installation

```bash
# Global CLI
npm install -g @mcp-guardian/server

# As MCP audit server only
npx @mcp-guardian/server

# From source
git clone https://github.com/rudraneel93/mcp-guardian.git
cd mcp-guardian
pnpm install && pnpm build
```

**PostgreSQL (optional):** Default storage is SQLite. For `DB_TYPE=postgres`, install the optional driver: `pnpm add pg` (included as an optional dependency; dynamic import only when PostgreSQL is enabled).

---

## CLI Reference

### `mcp-guardian wrap` (new in v2.5)

```bash
mcp-guardian wrap --client cline              # auto-detect config
mcp-guardian wrap --client cursor --apply     # patch live ~/.cursor/mcp.json
mcp-guardian wrap --config ./mcp.json --policy default-policy.yaml
mcp-guardian wrap --skip github,mcp-guardian  # skip specific servers
```

### `mcp-guardian scan`

```bash
mcp-guardian scan --all
mcp-guardian scan --config ./mcp.json
mcp-guardian scan --fail-on-critical --fail-on-secrets --threshold-score 60
```

### `mcp-guardian audit` / `health` / `report`

```bash
mcp-guardian audit --all --server github
mcp-guardian health --all --fail-on-overload
mcp-guardian report --all --format markdown --output report.md
```

### `mcp-guardian proxy`

```bash
mcp-guardian proxy --config guardian-configs/github.json --policy default-policy.yaml
mcp-guardian proxy --policy ./policy.yaml --dry-run
mcp-guardian proxy --auth-issuer https://accounts.google.com --auth-audience my-app
```

Modes: `audit` | `warn` | `block`. Wrapper script: `scripts/guardian-proxy.sh` (sets DB path, dashboard, metrics).

Per-call sync evaluation stays fast (regex + semantic guards). When `GUARDIAN_LLM_ENABLED` is on, optional **async** LLM review runs post-hoc (`GUARDIAN_SEMANTIC_ASYNC=true`, default) and emits `async_semantic_flag` events without blocking JSON-RPC.

### `mcp-guardian policy test`

Policy playground — evaluate one `tools/call` without starting the proxy:

```bash
mcp-guardian policy test \
  --policy default-policy.yaml \
  --tool read_file \
  --args '{"path":"/etc/passwd"}'
```

Output is JSON: `{ "action", "rule", "reason", "mode" }`.

### `mcp-guardian ai rollback`

Restore the previous AI learning snapshot (weights/thresholds) after a bad accept cycle or drift:

```bash
mcp-guardian ai rollback
```

Equivalent dashboard route: `POST /api/ai/rollback`.

### `mcp-guardian tui`

```bash
mcp-guardian tui
mcp-guardian tui --policy default-policy.yaml
mcp-guardian tui --dashboard-url http://localhost:4000
```

Keys: `1`–`8` tabs, `Tab` next, `r` refresh, `Esc` quit. AI tab: `n` next suggestion, `a` accept, `x` reject.

Reads **`MCP_GUARDIAN_DB_PATH`** (default `~/.mcp-guardian/history.db`) in **read-only** mode so it can run beside a live proxy. Polls every **1.5s**; connects to **`ws://127.0.0.1:4000/ws`** only when a proxy (or dashboard) is actually listening — otherwise you will see `WS off (poll 1.5s)`, which is normal.

---

## Policy Engine & Rollout

Policies are YAML evaluated on every `tools/call`. Pipeline: recursive de-obfuscation → payload normalization (TR39 confusables → NFKC when `unicode_strict: true`) → **semantic guards** (path, SQL exfil, GitHub writes, prompt-injection in args) → semantic shell analysis → YAML rules (regex, tool deny, rate limits, RBAC) → OPA block (if configured) → `default_action`.

**Unicode homoglyphs:** Production policies ship with `unicode_strict: true` and load `assets/confusables.txt` (Unicode TR39) to fold lookalike letters (Greek, Cyrillic, Armenian, mathematical alphanumeric, small caps) before regex matching. Set `unicode_strict: false` in policy YAML for international teams that need literal Unicode in tool arguments. The asset resolves from `dist/` at `../assets/confusables.txt` (~728 KB).

False-positive tuning: reject a block via dashboard `POST /api/policy/fp/reject` with `{ "rule", "pattern" }` (or suggestion reject with `fpReject: true`). After **3** confirmations (`GUARDIAN_FP_WHITELIST_THRESHOLD`), the rule+pattern fingerprint is whitelisted in `~/.mcp-guardian/.fp-whitelist.json`.

```yaml
# default-policy.yaml (production — fail-closed)
policy:
  mode: block
  default_action: block   # tools not on allowlist are blocked
  semantic_shell: true
  unicode_strict: true   # TR39 confusables before NFKC; false in policy-demo.yaml
  rules:
    - name: block-shell-injection
      action: block
      patterns: [curl\s|wget\s, rm\s+-rf, \$\([^)]+\)]
    - name: deny-dangerous-tools
      action: block
      tools:
        deny: [execute_command, bash, sh, eval]
```

| Shipped file | `mode` | `default_action` | Use when |
|--------------|--------|------------------|----------|
| `policy-demo.yaml` | audit | pass | Local try-it / onboarding only |
| `policy-audit.yaml` | audit | pass | First week — observe only |
| `policy-warn.yaml` | warn | pass | Alert without blocking |
| `default-policy.yaml` | block | block | Production enforcement |

For a safe first run: `mcp-guardian proxy --policy policy-demo.yaml` (or `policy-audit.yaml`). Switch to `default-policy.yaml` before production.

**Hot-reload:** edit YAML while proxy runs — engine swaps atomically.

---

## Interactive TUI

The TUI is the **primary live-ops UI**. The browser dashboard on port 4000 is a **REST + WebSocket API** (metrics, audit, policy, AI accept/reject) — there is no shipped browser SPA yet. If you want a terminal view of what Guardian actually recorded, use the TUI.

```bash
pnpm run build
mcp-guardian doctor --policy default-policy.yaml   # DB path, policy, AI flags

# Terminal 1 — at least one wrapped proxy (or echo-test) writing history.db
mcp-guardian proxy --config mcp.json --policy default-policy.yaml

# Terminal 2 — dashboard (same DB, read-only)
pnpm run tui
```

### What the TUI shows (honestly)

| Tab | Source | Caveats |
|-----|--------|---------|
| Overview / Audit | `call_records` in SQLite | **Real data** from proxied `tools/call` only. No traffic → zeros. |
| Security | Latest `security_scans` per server | Scans can score **0/100** when CVE data is harsh — that is not “mock,” it is scan output. |
| Cost | Token fields on call records | **$0** until calls carry priced models/tokens. |
| Instances | One row per **MCP server name** in DB | Not “Guardian processes.” `echo-test` with scans but **no calls** still appears; **Servers w/ traffic** counts servers with `call_records` only. |
| AI Engine | Learning cycle + pending suggestions | **No fake TP/FP rates** until ≥5 labeled accept/reject outcomes. Suggestions can be **empty** on stable traffic (no anomalies). |
| FULL ANALYSIS | Rebuilt from DB when records exist | Ignores stale `~/.mcp-guardian/.ai-report.json` when live calls are present. |

### Live updates — what actually works

1. **Same database file.** TUI and proxy must use the **same** `MCP_GUARDIAN_DB_PATH`. If you see counts stuck at 21 while a script runs, check the demo/proxy log: it must say `history.db`, not `history-<pid>-<timestamp>.db`.
2. **WebSocket (fastest).** Start the proxy first (`GUARDIAN_WS_ENABLED=true` by default). TUI status should show **`WS live`**. Port **4000** must be free; otherwise the proxy runs without WS and the TUI polls only.
3. **Polling (fallback).** Read-only reopen every 1.5s picks up WAL commits from the proxy. Good enough for local dev; not a replacement for a shared Postgres tier in production.

### Multi-server traffic (local demo)

The stdio proxy handles **one MCP server per process**. Four servers in the wild means **four wrapped proxies** (or `wrap`), all pointing at the same `MCP_GUARDIAN_DB_PATH`.

For a **single-machine smoke test** without editing four configs:

```bash
# Terminal 1
pnpm run tui

# Terminal 2 — replays 21 corpus calls (pass + block) into the SAME history.db
pnpm run live:tui-demo                        # stream: ~1 call / 1.5s (watch counts climb)
node scripts/run-live-tui-demo.cjs            # one-shot burst (all 21 calls quickly)
```

This uses in-process proxies + `scenarios/dogfood/enterprise-mcp-stub.cjs` — **not** your real GitHub/Postgres MCP binaries. It proves policy + DB + TUI wiring; it does not prove your production MCP servers.

```bash
pnpm run dogfood    # sandboxed CI scenario (separate DB under scenarios/dogfood/sandbox)
```

**Do not** use `scripts/real-life-tui-prep.cjs` for “live” demos — it used to seed fake AI JSON; that seeding was removed. Prefer `live:tui-demo` or real proxy traffic.

### Limitations (read this before demoing to leadership)

- **Not a multi-proxy control plane.** One TUI process observes one SQLite file (or Postgres if configured). It does not discover other hosts or aggregate fleet-wide instances yet.
- **“6 inst” ≠ 6 live proxies.** The status bar counts **server names** known to the DB (calls + scans). Only **Servers w/ traffic** reflects tool calls.
- **WS off** is common if nothing listens on `:4000` or an old process holds the port — fix by stopping stray `node dist/cli.js proxy` processes, not by assuming the TUI is broken.
- **Learning while TUI is open** does not write to the DB (read-only). Run learning on the proxy process or restart TUI after `GUARDIAN_TUI_SKIP_LEARNING=true` if you only want display.
- **Docker:** bind-mount the same `history.db` into the container and the host TUI, or you will see different numbers on each side.

---

## Docker Compose

```bash
docker compose up --build
```

| Service | Port | Notes |
|---------|------|-------|
| mcp-guardian | 4000, 9090 | Proxy + dashboard + metrics |
| redis | 6379 | Rate-limit/session backing |

Volumes: `guardian-data` → `/data/history.db`. Config: `./mcp.json`, `./default-policy.yaml`. Entrypoint fixes volume permissions for non-root `appuser` (uid 1001).

**IDE note:** Cline on the host should use local `wrap` + `guardian-proxy.sh`, not stdio into the container. Use Compose for team demos, CI, and central observability.

---

## Kubernetes (Helm)

```bash
helm install guardian ./deploy/helm/mcp-guardian \
  -f deploy/helm/mcp-guardian/examples/developer-cline-values.yaml
```

Includes: Redis subchart, ServiceMonitor, ExternalSecrets, PDB, backup CronJob, `fsGroup: 1001`, `/readyz` probes.

```bash
# Team example values
deploy/helm/mcp-guardian/examples/developer-cline-values.yaml
```

See [deploy/PRODUCTION.md](deploy/PRODUCTION.md) for scaling and [docs/SCALE_AND_RESILIENCE.md](docs/SCALE_AND_RESILIENCE.md) for HA chaos-test results (PgBouncer required, cross-region limits).

```bash
docker run -v $(pwd)/mcp.json:/etc/mcp-guardian/mcp.json \
  -v $(pwd)/default-policy.yaml:/etc/mcp-guardian/policy.yaml \
  ghcr.io/rudraneel93/mcp-guardian:latest \
  proxy --config /etc/mcp-guardian/mcp.json --policy /etc/mcp-guardian/policy.yaml
```

---

## Environment Variables

Grouped by concern. Full behavior: linked docs and `src/` defaults.

### Policy & detection

| Variable | Default | Description |
|----------|---------|-------------|
| `OPA_URL` | — | OPA decision endpoint (block wins over YAML) |
| `GUARDIAN_WORKSPACE` | — | Restrict filesystem tool paths to this directory |
| `GUARDIAN_ALLOWED_PATH_PREFIXES` | — | Comma-separated path prefixes |
| `GUARDIAN_GITHUB_ALLOWED_ORGS` | — | Allowed GitHub orgs for `repo` arguments |
| `GUARDIAN_GITHUB_ALLOWED_REPOS` | — | Exact `org/repo` allowlist |
| `GUARDIAN_PROXY_ENTROPY` | on in `block` | Block high-entropy / base64 in arguments |
| `GUARDIAN_BLOCK_ON_CVE` | `false` | Opt-in CVE gate on `tools/call` |
| `GUARDIAN_CVE_BLOCK_SEVERITY` | `CRITICAL` | `HIGH` widens blocking when gate on |
| `GUARDIAN_PLUGINS_ENABLED` | off | Experimental detector plugins |
| `GUARDIAN_PLUGIN_PATH` | — | Directory of `*.js` plugins |
| `GUARDIAN_SEMANTIC_ASYNC` | on w/ LLM | Post-hoc LLM audit (non-blocking) |
| `GUARDIAN_SEMANTIC_DEBOUNCE_MS` | `500` | Async semantic queue debounce |
| `GUARDIAN_FP_WHITELIST_THRESHOLD` | `3` | FP confirmations before auto-whitelist |
| `GUARDIAN_FP_WHITELIST_PATH` | `~/.mcp-guardian/.fp-whitelist.json` | FP whitelist file |
| `POLICY_AUDIT_ENABLED` | `false` | Policy change JSONL audit |
| `GUARDIAN_DISALLOW_MODE_OVERRIDE` | `false` | Ignore CLI `--blocking-mode` when `true` |

### Auth & dashboard

| Variable | Default | Description |
|----------|---------|-------------|
| `DASHBOARD_ENABLED` | `false` | REST + WebSocket API on port 4000 |
| `DASHBOARD_AUTH_DISABLED` | `false` | `true` = local dev only (no auth) |
| `DASHBOARD_API_KEY` | — | API key / login shortcut when auth on |
| `DASHBOARD_JWT_SECRET` | — | HMAC session tokens |
| `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` | — | Dashboard login |
| `DASHBOARD_ALLOWED_ORIGINS` | localhost | CORS allowlist |
| `GUARDIAN_TENANT_ID` | `default` | Tenant label for audit/rate limits |

### AI learning

| Variable | Default | Description |
|----------|---------|-------------|
| `GUARDIAN_AI_ENABLED` | `true` | Learning in proxy/TUI (`false` to disable) |
| `GUARDIAN_AI_AUTO_APPLY` | `false` | Auto-apply generated rules (`true` = risky) |
| `GUARDIAN_AI_ON_CLI` | `false` | Learning on `scan`/`audit`/`health`/`report` |
| `GUARDIAN_AI_BLOCK_DEBOUNCE_MS` | `30000` | Debounce after proxy blocks |
| `GUARDIAN_AI_ATTACK_MIN_BLOCKS` | `3` | Min blocks before attack suggestions |
| `GUARDIAN_AI_MIN_DISTINCT_LABELERS` | `2` | Quorum: distinct labelers |
| `GUARDIAN_AI_MIN_TOTAL_LABELS` | `10` | Quorum: weighted label total |
| `GUARDIAN_AI_DRIFT_OVERRIDE` | `false` | Unfreeze tuning after drift detection |
| `GUARDIAN_TUI_USER` | `$USER` | Label identity for quorum |
| `ANTHROPIC_API_KEY` | — | LLM semantic layer |

### Cost & observability

| Variable | Default | Description |
|----------|---------|-------------|
| `METRICS_ENABLED` | `false` | Prometheus on 9090 |
| `METRICS_MAINTENANCE_INTERVAL_MS` | `60000` | Registry refresh (cleared on shutdown) |
| `MCP_GUARDIAN_SIEM_*` | — | SIEM export |
| `ALERT_WEBHOOK_URL` | — | Slack/Discord on policy blocks |
| `NVD_API_KEY` | — | NVD CVE lookups |

### HA & database

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_GUARDIAN_DB_PATH` | `~/.mcp-guardian/history.db` | SQLite path |
| `DB_TYPE` | `sqlite` | `postgres` for shared store |
| `DATABASE_URL` | — | Postgres URL; **use PgBouncer** for multi-replica |
| `GUARDIAN_REQUIRE_PGBOUNCER` | `false` | Exit if URL is not pooler-shaped |
| `REDIS_URL` | — | Multi-replica rate limits (single-region) |
| `GUARDIAN_STRICT_MODE` | `false` | Fail startup without Redis in K8s |
| `GUARDIAN_AUDIT_SYNC_ENABLED` | `false` | Sync SQLite → PostgreSQL |

### Windows

| Variable | Default | Description |
|----------|---------|-------------|
| *(none required)* | — | Use `guardian-proxy.ps1` via `wrap` on win32; see [WINDOWS.md](docs/WINDOWS.md) |

### IDE & remote

| Variable | Default | Description |
|----------|---------|-------------|
| `GUARDIAN_REMOTE_SSH` | `false` | Map local paths for path-guard |
| `GUARDIAN_REMOTE_PATH_MAP` | — | JSON or `local=/remote` pairs |
| `GUARDIAN_WS_ENABLED` | `true` (proxy) | WebSocket `/ws` for TUI |
| `GUARDIAN_DASHBOARD_URL` | `http://127.0.0.1:4000` | TUI WS + API base |
| `GUARDIAN_TUI_SKIP_LEARNING` | `false` | TUI display-only |
| `GUARDIAN_SKIP_PREFLIGHT_SCAN` | `false` | Skip CVE scan on proxy start |

---

## Production Checklist

Short list before `default-policy.yaml` + block mode in production:

1. **Policy** — Roll out `policy-audit.yaml` → `policy-warn.yaml` → `default-policy.yaml`; run `mcp-guardian policy test` on risky tools; set `GUARDIAN_WORKSPACE` or path prefixes.
2. **Auth** — `DASHBOARD_AUTH_DISABLED` must be **false** on any exposed dashboard; set `DASHBOARD_API_KEY` or JWT secret + credentials.
3. **HA** — `REDIS_URL` + `GUARDIAN_STRICT_MODE=true` for multi-replica; `DATABASE_URL` through **PgBouncer**; `GUARDIAN_REQUIRE_PGBOUNCER=true` optional guardrail; single-region Redis only.
4. **CVE** — Decide explicitly: `GUARDIAN_BLOCK_ON_CVE=true` or leave off (default).
5. **AI** — Keep `GUARDIAN_AI_AUTO_APPLY=false`; configure quorum env vars if multiple operators label suggestions.
6. **Verify** — `mcp-guardian doctor`, `mcp-guardian proxy --dry-run`, shared `MCP_GUARDIAN_DB_PATH` for proxy + TUI.

---

## Architecture

```
 AI Client (Cline/Cursor)
        │ stdio JSON-RPC
        ▼
 ┌──────────────────────────────┐
 │  guardian-proxy.sh           │
 │  ┌────────────────────────┐  │
 │  │ PolicyEngine           │  │──► block / flag / pass
 │  │ (audit/warn/block)     │  │
 │  └──────────┬─────────────┘  │
 │             │ forward          │
 │  ┌──────────▼─────────────┐  │
 │  │ Upstream MCP (child)   │  │
 │  └────────────────────────┘  │
 │  HistoryDatabase + metrics   │
 └──────────────────────────────┘
```

**Data flow:** client `tools/call` → JWT (optional) → policy → upstream or JSON-RPC error `-32001` → audit DB → dashboard/metrics/SIEM.

---

## Development

```bash
git clone https://github.com/rudraneel93/mcp-guardian.git
cd mcp-guardian
pnpm install && pnpm build && pnpm test
./scripts/verify-live-integration.sh
pnpm run dogfood          # sandboxed multi-server scenario (CI)
pnpm run live:tui-demo    # write shared ~/.mcp-guardian/history.db for TUI smoke test
pnpm eval                 # red-team corpus
```

Monorepo layout: [packages/PACKAGING.md](packages/PACKAGING.md)

**Supply chain:** `pnpm-lock.yaml` is committed; use `pnpm install --frozen-lockfile`. CI runs `pnpm audit --audit-level=high` and publishes CycloneDX SBOMs. npm releases use `--provenance` on version tags; GHCR images are cosign-signed. We do **not** claim SLSA Level 3 yet — see [docs/SUPPLY_CHAIN.md](docs/SUPPLY_CHAIN.md).

---

## FAQ

### How do I connect Cline in real time?

Run `mcp-guardian wrap --client cline --policy policy-audit.yaml --apply`, restart VS Code, use Cline normally. See [docs/REAL_WORLD_INTEGRATION.md](docs/REAL_WORLD_INTEGRATION.md).

### How is this different from a WAF?

MCP Guardian understands `tools/call`, tool names, argument schemas, and MCP server CVEs — not just HTTP patterns.

### Does the proxy add latency?

Typically **5–25ms** per call for regex/schema policy (JWT +5–15ms). LLM semantic runs at manifest time, not per call.

### Can I run without blocking?

Use `policy-audit.yaml` or set `mode: audit` in your policy file.

### Cline and OAuth?

Clients don’t send JWTs natively. Use audit mode, `AUTH_TOKEN` in `guardian-configs/*.json`, or an API gateway in front of Guardian.

### TUI vs Docker database?

TUI reads `~/.mcp-guardian/history.db` (or `MCP_GUARDIAN_DB_PATH`). Docker uses `/data` unless you bind-mount the **same file** into the container and host. Different paths = different numbers — not a sync bug.

### Why does the TUI show 0 records or frozen counts?

Usually one of:

1. **Wrong DB file** — another process wrote to `history-<pid>-<timestamp>.db` while the TUI reads `history.db`. Run `mcp-guardian doctor`, check the TUI footer `DB:` line, and ensure proxy/demo/proxy logs reference the same path.
2. **No proxied traffic yet** — scan-only data does not create `call_records`. Run a wrapped server or `pnpm run live:tui-demo`.
3. **Stale build** — `pnpm run build` after pulling; the TUI runs `dist/cli.js`, not TypeScript sources.
4. **Port 4000 busy** — proxy skips dashboard/WS; TUI falls back to polling (still works if the DB is shared).

### Why does FULL ANALYSIS disagree with the summary?

Older builds cached text in `~/.mcp-guardian/.ai-report.json` from a single-server run. Current builds regenerate analysis from the DB when `call_records` exist. Delete `.ai-report.json` if you still see mismatches after upgrading.

### Multi-replica?

Set `REDIS_URL` and `GUARDIAN_STRICT_MODE=true`. Use PostgreSQL for shared audit (`DB_TYPE=postgres`) with **PgBouncer** in front (direct `:5432` exhausts `max_connections` under load). Optional: `GUARDIAN_REQUIRE_PGBOUNCER=true`. **Do not** run Redis active-active across regions (>80ms RTT breaks locks). See [docs/SCALE_AND_RESILIENCE.md](docs/SCALE_AND_RESILIENCE.md).

### How do I verify policy before block mode?

```bash
mcp-guardian proxy --policy default-policy.yaml --dry-run
```

### How do I contribute?

See [CONTRIBUTING.md](CONTRIBUTING.md). Run `pnpm install && pnpm build && pnpm test`.

---

## Roadmap

### Shipped in v2.6.x
- OPA block precedence, non-blocking policy hot-reload
- Windows `guardian-proxy.ps1` + `wrap` on win32
- PgBouncer mandatory guidance (>50 replicas / multi-replica Postgres)
- AI quorum, drift detection, `mcp-guardian ai rollback`
- Dashboard CSRF, session regeneration, fail-closed auth
- DPoP `jti` replay protection
- Metrics dispose, SQLite busy retry, Remote SSH path map
- Experimental detector plugins (`GUARDIAN_PLUGINS_ENABLED`)

### Planned
- **v2.6+** — Browser SPA on existing `/api` + WebSocket (today: TUI + raw API)
- **v2.7** — Windows MSI installer
- **v2.x** — Inbound HTTP/SSE gateway; fleet aggregation; enhanced SIEM templates
- **v3.0** — Multi-tenant control plane; full custom detector SDK; gRPC transport

---

## License

MIT — see [LICENSE](LICENSE).

---

**Docs:** [Real-world integration](docs/REAL_WORLD_INTEGRATION.md) · [Policy](docs/POLICY.md) · [Cost governance](docs/COST_GOVERNANCE.md) · [Scale & resilience](docs/SCALE_AND_RESILIENCE.md) · [Windows](docs/WINDOWS.md) · [Remote SSH](docs/REMOTE_SSH.md) · [Dev containers](docs/DEVCONTAINERS.md) · [Extensibility](docs/EXTENSIBILITY.md) · [Supply chain](docs/SUPPLY_CHAIN.md) · [Production](deploy/PRODUCTION.md) · [Compliance](docs/COMPLIANCE.md) · [Threat model](docs/THREAT_MODEL.md) · [Security](SECURITY.md)

**Built with** TypeScript, better-sqlite3 12.10+, pino, prom-client, jose 6.x, commander, chalk, tiktoken, and the MCP SDK.
