# MCP Guardian

**A safety layer between your AI assistant and the tools it uses.**

[![npm version](https://img.shields.io/npm/v/@mcp-guardian/server)](https://www.npmjs.com/package/@mcp-guardian/server)
[![npm downloads](https://img.shields.io/npm/dm/@mcp-guardian/server)](https://www.npmjs.com/package/@mcp-guardian/server)
[![Socket Badge](https://badge.socket.dev/npm/package/@mcp-guardian/server/4.1.6)](https://badge.socket.dev/npm/package/@mcp-guardian/server/4.1.6)
[![Website](https://img.shields.io/badge/Website-mcp--guardian--cloud.vercel.app-0070f3)](https://mcp-guardian-cloud.vercel.app/)
[![mcp-guardian MCP server](https://glama.ai/mcp/servers/rudraneel93/mcp-guardian/badges/score.svg)](https://glama.ai/mcp/servers/rudraneel93/mcp-guardian)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![MCP SDK](https://img.shields.io/badge/MCP_SDK-1.25-green)](https://github.com/modelcontextprotocol/typescript-sdk)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)
[![CI](https://github.com/rudraneel93/mcp-guardian/actions/workflows/ci.yml/badge.svg)](https://github.com/rudraneel93/mcp-guardian/actions/workflows/ci.yml)

**Version 4.1.6** · [Website](https://mcp-guardian-cloud.vercel.app) · [npm](https://www.npmjs.com/package/@mcp-guardian/server) · [Install & troubleshooting](docs/INSTALL.md) · [Changelog](CHANGELOG.md)

### What's new in 4.1.6

- **`mcp-guardian start`** — one command for proxy + dashboard at [http://localhost:4000](http://localhost:4000)
- **`mcp-guardian setup`** — one-shot dev install for git clones
- **npm package** — prebuilt dashboard UI ships in the tarball (no manual SPA build for npm users)
- **Simpler docs** — install and troubleshooting first; see [CHANGELOG.md](CHANGELOG.md) for older releases

---

## Quick start

**Use npm (most people):**

```bash
npm install -g @mcp-guardian/server@latest
mcp-guardian onboard --apply
mcp-guardian start
```

Open **http://localhost:4000**. Verify with `mcp-guardian doctor`.

**Develop from git:**

```bash
git clone https://github.com/rudraneel93/mcp-guardian.git && cd mcp-guardian
pnpm install && pnpm build && pnpm setup
mcp-guardian start
```

Optional: `mcp-guardian onboard --apply --start` runs onboard and starts the dashboard in one step.

---

## Installation

### What you need

| Requirement | Notes |
|-------------|--------|
| **Node.js 18+** | Required |
| **npm** | For global install (`npm install -g`) |
| **pnpm + git** | Only if you clone the repo to develop |
| **Ollama** (optional) | Local LLM at `http://127.0.0.1:11434` for semantic checks and Threat Lab |

### npm users (step by step)

**1. Install the CLI**

```bash
npm install -g @mcp-guardian/server@latest
```

You get the `mcp-guardian` command, compiled server code, policy templates, and a **prebuilt dashboard** (no need to run Next.js yourself).

**2. Wrap your IDE’s MCP servers**

```bash
mcp-guardian onboard --apply
```

Guardian finds configs for Cursor, Cline, Claude Desktop, or Windsurf, wraps each tool server with the proxy, and saves status to `~/.mcp-guardian/onboard.json`. Per-server configs go in `guardian-configs/` under your current directory.

**3. Restart your AI client**

Reload MCP in the IDE (restart Cursor/Cline or reconnect MCP) so traffic goes through Guardian.

**4. Start the proxy and dashboard**

```bash
mcp-guardian start
```

This starts one process: MCP proxy, REST API, and web UI on port **4000**, using `~/.mcp-guardian/history.db` for audit logs.

### Developers (git clone)

After cloning, run setup once:

```bash
pnpm install && pnpm build && pnpm setup
```

`mcp-guardian setup` (or `pnpm setup`) installs workspace packages, builds the server, and builds the dashboard SPA. Then use `mcp-guardian start` like npm users.

Repo-only shortcut: `pnpm dashboard:proxy` does the same job with extra dev env defaults (see [For developers](#for-developers)).

### After install

- Open **http://localhost:4000** → try **Protection**, **Activity**, and **Settings**.
- If charts are empty, widen the **time window** (e.g. Last 7 days) or use your IDE so Guardian logs real tool calls.
- Run `mcp-guardian doctor` if something looks wrong.

### Commands you’ll use

| Command | What it does |
|---------|----------------|
| `mcp-guardian start` | Proxy + dashboard (recommended) |
| `mcp-guardian onboard --apply` | Wrap IDE MCP configs |
| `mcp-guardian setup` | Dev: install + build monorepo + dashboard SPA |
| `mcp-guardian doctor` | Check install, DB, SPA, config |
| `mcp-guardian proxy --config … --policy …` | Advanced: proxy only, manual env vars |

**Important:** One `mcp-guardian start` process handles **one stdio MCP server** per config file. Multiple servers need separate configs or proxies — see [docs/REAL_WORLD_INTEGRATION.md](docs/REAL_WORLD_INTEGRATION.md).

---

## Troubleshooting

| Symptom | What to do |
|---------|------------|
| **`next: command not found`** (dashboard build) | npm users: reinstall `@mcp-guardian/server@latest`. Git: run `mcp-guardian setup` |
| **`benchmark-report.json` missing** | Pull latest `main`; file should be in `deploy/dashboard-spa/app/data/` |
| **`pnpm dashboard:proxy` not found** | Run from repo root, or use **`mcp-guardian start`** from anywhere |
| **No MCP config found** | Run `mcp-guardian onboard --apply`, or `mcp-guardian start --config path/to/guardian-configs/foo.json` |
| **Database disk I/O error** | Stop proxy; remove `history.db-wal`, `-shm`, `.pid`; set `MCP_GUARDIAN_DB_PATH` and restart |
| **Port 4000 in use** | `lsof -ti :4000 \| xargs kill` or `DASHBOARD_PORT=4001 mcp-guardian start` |
| **`better-sqlite3` errors** (pnpm 10) | `pnpm approve-builds` → allow better-sqlite3 → `pnpm install` |
| **Empty dashboard charts** | Same `MCP_GUARDIAN_DB_PATH` as proxy; widen time window; generate traffic (see [For developers](#for-developers)) |
| **npm `InstallError` / `workspace:`** | Use `@mcp-guardian/server@4.1.5` or newer, not 4.1.1–4.1.4 |
| **Pro features locked** | Production: [PRO_SETUP.md](docs/PRO_SETUP.md). Local dev: `mcp-guardian start` sets license bypass |
| **Ollama warning** | Optional — run `ollama serve` for semantic / Threat Lab features |

**Full fixes with copy-paste commands:** [docs/INSTALL.md](docs/INSTALL.md)

---

## What problem does this solve?

AI assistants (Claude, Cursor, Cline, and others) connect to **tools** via MCP — read files, run commands, query databases, and more. That is powerful and risky:

- The AI might read files it should not see.
- It might run harmful shell commands or leak secrets in tool arguments.
- API costs can spike without warning.

**MCP Guardian sits in the middle.** Every tool request goes through Guardian first. Guardian checks your rules, blocks bad requests, logs what happened, and shows you a live dashboard before anything reaches your real tools.

```
Your AI assistant
       │
       ▼
  MCP Guardian  ← rules, block, log
       │
       ▼
  Your real tools (files, GitHub, database, …)
```

---

## How it works

1. Install Guardian and run **`mcp-guardian onboard --apply`** (or wrap configs manually).
2. Your IDE talks to Guardian instead of talking to tools directly.
3. On each tool call, Guardian checks your **policy** (YAML rules you control).
4. Allowed calls go to the real tool; blocked calls never reach it.
5. Every decision is saved to a local database for the dashboard and audits.

Guardian does not change your policy unless you approve suggestions (for example from Threat Lab).

---

## Core features

| Feature | What you get | Learn more |
|---------|--------------|------------|
| **Policy proxy** | Allow/deny tools, rate limits, token caps, pattern matches on arguments | [docs/POLICY.md](docs/POLICY.md) |
| **Attack blocking** | Hundreds of built-in checks (path traversal, injection, exfil patterns, Unicode tricks) | `default-policy.yaml` |
| **Audit log** | Every allow/block stored locally (default `~/.mcp-guardian/history.db`) | Dashboard → **Activity** |
| **Cost tracking** | Token and dollar estimates per call; budget alerts | Dashboard → **Operations** |
| **Health monitoring** | Per-server success rate, latency, circuit breaker | Dashboard → **Operations** |
| **Package scanning** | CVE and typo-squat checks on MCP packages | Supply-chain tools in UI |
| **Adversarial harness** | 800+ offline attack fixtures against your policy (dev) | `pnpm harness` |
| **Real-life scenarios** | Live attacks through a real filesystem MCP server (dev) | `pnpm real-life:filesystem` |

The policy file is your main control surface. The bundled `default-policy.yaml` already blocks many common attack patterns. Templates live in `policy-templates/`.

---

## Web dashboard

**URL:** [http://localhost:4000](http://localhost:4000) (after `mcp-guardian start`)

The UI reads the **same database** as the proxy — not demo data.

| Tab | What you see |
|-----|----------------|
| **Protection** | Overall status and analysis of your setup |
| **Activity** | Audit log of allowed and blocked tool calls |
| **Threats** | Active threats and quarantine |
| **Security** | Security score and trends |
| **Operations** | Traffic, errors, and cost over time |
| **Agentic AI** | Trust scores, policy suggestions, roadmap compliance |
| **Settings** | Servers, policy, setup checklist |

**Tip:** If charts look empty, widen the time window (e.g. **Last 7 days**).

---

## Agentic AI

Smart assistants inside Guardian watch traffic, score risk, and recommend changes. **Your policy stays in control** until you approve a suggestion.

| Feature | What it does |
|---------|----------------|
| Threat prediction | Scores MCP server risk and suggests hardening |
| Policy generation | Drafts a least-privilege policy from observed tool use |
| Prompt injection detection | Scans tool arguments (heuristic + optional LLM) |
| Threat mesh (MTX) | Opt-in anonymized pattern sharing (`@mcp-guardian/mtx`) |
| Drift detection | Alerts when server tools or behavior change |
| Collusion / attack chains | Multi-step patterns across tools and sessions |
| Trust score & reputation | Local and fleet reputation with enforcement |
| Compliance mapping | SOC 2, HIPAA, PCI-DSS, FedRAMP, ISO 27001 evidence |
| Incident playbooks | Automated steps and AI-assisted investigation |

Open **Agentic AI** in the dashboard. Industry roadmap modules (A1–C5): [docs/AGENTIC_ROADMAP.md](docs/AGENTIC_ROADMAP.md). Verify with `mcp-guardian roadmap audit`.

More: [docs/AGENTIC_FEATURES.md](docs/AGENTIC_FEATURES.md) · [docs/AGENTIC_QUICKSTART.md](docs/AGENTIC_QUICKSTART.md)

---

## Pro (licensed)

These need a Pro license in production. Local dev unlocks them when you run **`mcp-guardian start`** (license bypass for localhost).

| Feature | Summary | Run (dev repo) |
|---------|---------|----------------|
| **Security Swarm** | Automated adversarial testing; learns from real blocks | `pnpm security-swarm` |
| **Threat Lab** | LLM proposes new attack patterns; you approve | `pnpm security-swarm:threat-lab` (needs Ollama) |
| **Auto Threat Research** | Background analysis when suspicious calls are blocked | `GUARDIAN_THREAT_RESEARCH_AUTO=true` |
| **Guardian Autopilot** | Wrap configs + start full stack | `pnpm autopilot:init -- --apply` then `pnpm autopilot:start` |

Setup: [docs/PRO_SETUP.md](docs/PRO_SETUP.md) · Threat Lab: [docs/THREAT_LAB.md](docs/THREAT_LAB.md)

---

## Free vs Pro

| Capability | Free (MIT) | Pro |
|------------|------------|-----|
| Policy proxy, blocking, audit log | Yes | Yes |
| Web dashboard (local) | Yes | Yes |
| Agentic AI (core modules) | Yes | Yes |
| Adversarial harness & real-life scenarios | Yes | Yes |
| Security Swarm, Threat Lab, Autopilot | No | Yes |
| Fleet, SSO, Kubernetes, PostgreSQL | No | Yes |

Community scope: [COMMUNITY_SCOPE.md](COMMUNITY_SCOPE.md). Pro license: [mcp-guardian-cloud.vercel.app](https://mcp-guardian-cloud.vercel.app).

---

## The policy file

Rules live in `default-policy.yaml` or a path you pass to `--policy`. Example:

```yaml
version: '1.0'
policy:
  mode: block
  default_action: block

  rules:
    - name: allow-safe-tools
      description: Only allow read-only tools
      action: block
      tools:
        allow:
          - read_file
          - list_directory
          - search

    - name: block-shell-commands
      description: Never let the AI run shell commands
      action: block
      tools:
        deny:
          - bash
          - execute_command
          - eval

    - name: rate-limit
      description: Max 60 tool calls per minute
      action: block
      maxCallsPerMinute: 60
```

Full reference: [docs/POLICY.md](docs/POLICY.md).

---

## Common settings

| Variable | Meaning |
|----------|---------|
| `MCP_GUARDIAN_DB_PATH` | Audit database (default `~/.mcp-guardian/history.db`) |
| `MCP_GUARDIAN_POLICY` | Path to your YAML rules |
| `DASHBOARD_PORT` | Dashboard URL port (default `4000`) |
| `DASHBOARD_ENABLED` | REST API + UI (`true` when using `mcp-guardian start`) |
| `GUARDIAN_LLM_ENABLED` / `OLLAMA_BASE_URL` | Local LLM for semantic features |
| `GUARDIAN_CI_BYPASS_LICENSE` | Local dev only — unlock Pro dashboard features |
| `GUARDIAN_DAILY_BUDGET_USD` | Daily spend alert threshold |
| `MCP_GUARDIAN_SIEM_ENABLED` | Export blocks/audit to Splunk, Datadog, webhooks |

Full list: [`.env.example`](.env.example). Teams and Redis/Postgres: [docs/ENTERPRISE_DEPLOYMENT.md](docs/ENTERPRISE_DEPLOYMENT.md).

---

## Supported AI clients

Guardian can auto-wrap configs for:

- **Cursor**
- **Cline** (VS Code)
- **Claude Desktop**
- **Windsurf**

Or point at any MCP config: `mcp-guardian start --config path/to/config.json`.

---

## For developers

**Architecture:** One Node process runs the proxy, dashboard API, and static UI. Deep diagrams and transport details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/MCP_GUARDIAN_TECHNICAL_OVERVIEW.md](docs/MCP_GUARDIAN_TECHNICAL_OVERVIEW.md).

**Useful commands (from repo root):**

```bash
pnpm test                    # unit tests
pnpm harness                 # offline adversarial matrix
pnpm real-life:filesystem    # live MCP attack smoke (proxy must be running)
pnpm analyze                 # plain-English security summary
mcp-guardian roadmap audit   # industry roadmap module check
pnpm dashboard:dev           # SPA hot reload (with mcp-guardian start in another terminal)
```

Share `MCP_GUARDIAN_DB_PATH` between the proxy and test runners so the dashboard shows results.

Publish npm packages: `./scripts/publish-npm-all.sh`. Install hygiene: [SECURITY.md](SECURITY.md).

---

## Documentation map

| Topic | Document |
|-------|----------|
| **Installation & troubleshooting** | [docs/INSTALL.md](docs/INSTALL.md) |
| Agentic AI (features) | [docs/AGENTIC_FEATURES.md](docs/AGENTIC_FEATURES.md) |
| Agentic quickstart | [docs/AGENTIC_QUICKSTART.md](docs/AGENTIC_QUICKSTART.md) |
| Agentic roadmap | [docs/AGENTIC_ROADMAP.md](docs/AGENTIC_ROADMAP.md) |
| Policy reference | [docs/POLICY.md](docs/POLICY.md) |
| Pro license | [docs/PRO_SETUP.md](docs/PRO_SETUP.md) |
| Enterprise deploy | [docs/ENTERPRISE_DEPLOYMENT.md](docs/ENTERPRISE_DEPLOYMENT.md) |
| Multi-server proxies | [docs/REAL_WORLD_INTEGRATION.md](docs/REAL_WORLD_INTEGRATION.md) |
| Architecture | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Release history | [CHANGELOG.md](CHANGELOG.md) |

---

## License

**Community features** (proxy, policy, scanning, harness, real-life scenarios) are **MIT** — see [LICENSE](LICENSE) and [COMMUNITY_SCOPE.md](COMMUNITY_SCOPE.md).

**Pro features** require a license in production: [mcp-guardian-cloud.vercel.app](https://mcp-guardian-cloud.vercel.app). See [LICENSE-PRO](LICENSE-PRO).
