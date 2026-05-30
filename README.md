# MCP Guardian

**A safety layer between your AI assistant and the tools it uses.**

[![npm version](https://img.shields.io/npm/v/@mcp-guardian/server)](https://www.npmjs.com/package/@mcp-guardian/server)
[![npm downloads](https://img.shields.io/npm/dm/@mcp-guardian/server)](https://www.npmjs.com/package/@mcp-guardian/server)
[![Website](https://img.shields.io/badge/Website-mcp--guardian--cloud.vercel.app-0070f3)](https://mcp-guardian-cloud.vercel.app/)
[![mcp-guardian MCP server](https://glama.ai/mcp/servers/rudraneel93/mcp-guardian/badges/score.svg)](https://glama.ai/mcp/servers/rudraneel93/mcp-guardian)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![MCP SDK](https://img.shields.io/badge/MCP_SDK-1.25-green)](https://github.com/modelcontextprotocol/typescript-sdk)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)
[![CI](https://github.com/rudraneel93/mcp-guardian/actions/workflows/ci.yml/badge.svg)](https://github.com/rudraneel93/mcp-guardian/actions/workflows/ci.yml)

**Version 3.4.1** · [Website](https://mcp-guardian-cloud.vercel.app) · [npm](https://www.npmjs.com/package/@mcp-guardian/server) · [Changelog](CHANGELOG.md)

### What's new in 3.4.1

Production hardening from the code review remediation: JWKS auto-refresh, payload limits on all MCP transports, rate limits that survive policy hot-reload, audit retention and optional field encryption, SIEM events on every block path, Redis circuit-breaker sync, and graceful shutdown draining.

---

## What problem does this solve?

Modern AI assistants (Claude, Cursor, Cline, and others) can connect to **tools** — read files, run commands, query databases, post to Slack, and more. Those connections often use a standard called **MCP** (Model Context Protocol).

That power is useful, but risky:

- The AI might read files it should not see.
- It might run shell commands or delete data by mistake or because of a malicious prompt.
- Secrets can leak through tool arguments.
- API costs can spike without you noticing.

**MCP Guardian sits in the middle.** Every tool request goes through Guardian first. Guardian checks your rules, blocks bad requests, logs what happened, and can show you a live dashboard — **before** anything reaches your real tools.

```
Your AI assistant
       │
       ▼
  MCP Guardian  ← reads your rules, blocks bad calls, keeps a log
       │
       ▼
  Your real tools (files, GitHub, database, …)
```

---

## How it works (step by step)

1. **You install Guardian** and point it at your existing MCP setup (or run `mcp-guardian onboard` to do this automatically).
2. **Guardian wraps your tool servers** so the AI talks to Guardian instead of talking to them directly.
3. When the AI tries to use a tool, Guardian receives the request first.
4. Guardian compares the request to your **policy** (a simple rules file you control).
5. If the request is allowed, Guardian forwards it to the real tool and returns the result.
6. If the request breaks a rule, Guardian **blocks it** and tells the AI it was denied — the real tool never runs.
7. Every allow and block is saved to a local database so you can review history and see charts on the dashboard.

You stay in control: Guardian does not silently change your rules unless you approve it (for example when reviewing Threat Lab suggestions).

---

## Features explained

Below is what each major capability does, in plain language.

### Policy proxy (the core)

**What it is:** A filter on every tool call.

**How it works:** You write rules in a YAML file (see [The policy file](#the-policy-file) below). Rules can allow specific tools, deny dangerous ones, limit how often tools run, cap token usage, and match patterns in arguments (for example “block if the path contains `../`”). When you change the file, Guardian can reload rules without restarting.

**Why it matters:** This is your main line of defense — fast, predictable, and fully under your control.

---

### Attack blocking (built into the default policy)

**What it is:** Hundreds of pre-written checks for common abuse.

**How it works:** Before a call reaches your server, Guardian looks for things like shell commands hidden in arguments, path traversal (`../etc/passwd`), SQL injection patterns, attempts to exfiltrate secrets, suspicious URLs, and Unicode tricks that hide malicious text. If a pattern matches, the call is blocked and logged.

**Why it matters:** Many real-world attacks look like normal tool calls; these checks catch a large class of them without an AI model.

---

### Cost tracking

**What it is:** A running tally of how much your tool usage costs.

**How it works:** Guardian estimates tokens and dollar cost per call (using model pricing when available). You can set budgets and see burn rate over time in the dashboard.

**Why it matters:** Runaway agents or loops can get expensive; you see it early.

---

### Health monitoring

**What it is:** A health check for each connected MCP server.

**How it works:** Guardian tracks success rate, latency, and whether a server is responding. If a server keeps failing, a circuit breaker can stop hammering it.

**Why it matters:** You notice broken or flaky integrations before users complain.

---

### Live audit log

**What it is:** A permanent record of what was allowed and what was blocked.

**How it works:** Each decision is stored in a local SQLite database (default: `~/.mcp-guardian/history.db`). The dashboard reads this database to show tables, charts, and filters.

**Why it matters:** Security and debugging need a clear trail — who tried what, when, and why it was blocked.

---

### Package scanning (CVE and typo-squat)

**What it is:** A check on MCP packages before you trust them.

**How it works:** Guardian can scan installed or configured packages for known security issues (CVEs) and names that look like famous packages but are slightly misspelled (typo-squatting).

**Why it matters:** Supply-chain attacks often arrive as “almost the right” package name.

---

### Adversarial harness (offline tests)

**What it is:** A large automated test suite that fires attack-like requests at your policy **without** a live AI.

**How it works:** Run `pnpm harness` from the repo. It replays 800+ fixtures and reports what would be blocked or allowed.

**Why it matters:** You can change rules and immediately see if you broke legitimate use or left a hole open.

---

### Real-life scenarios (live tests)

**What it is:** A short or long run of real attack traffic against a real filesystem MCP server through Guardian.

**How it works:** Commands like `pnpm real-life:filesystem` drive the official filesystem server with path traversal, injection, and similar tests while the proxy is running. Results show up in the dashboard if you use the same database path.

**Why it matters:** Offline tests are fast; live tests prove the full path (proxy → policy → log → UI) works.

---

## Agentic AI features (version 3.4)

These are **smart assistants inside Guardian** that watch, score, and recommend — they do not replace your policy unless you choose to apply a suggestion.

| Feature | What it does for you |
|--------|----------------------|
| **Threat prediction** | Scores how risky each MCP server is and suggests hardening before something breaks. |
| **Policy generation** | Watches normal tool use, then drafts a tight “only what you actually need” policy you can review. |
| **Prompt injection detection** | Scans tool arguments for text meant to hijack another AI (hidden instructions, role tricks, etc.). |
| **Threat mesh** | Optionally shares anonymized attack patterns with other deployments — never raw payloads. |
| **Honeypots** | Deploys fake decoy servers; if something probes them, you know you have unwanted attention. |
| **Supply chain checks** | Verifies publishers, flags dependency confusion and typo-squat names, can export a software bill of materials. |
| **Compliance mapping** | Maps your posture to frameworks like SOC 2, HIPAA, PCI-DSS, FedRAMP, and ISO 27001 with scores and gaps. |
| **Drift detection** | Notices when a server’s tools or behavior change unexpectedly (possible compromise or silent update). |
| **Red team engine** | Runs curated and mutated attacks against your setup so you see what might still get through. |
| **Trust protocol** | Lets two AI agents negotiate limited, time-boxed trust instead of sharing full access. |

**Dashboard:** Open **Agentic AI** in the web UI for overview charts, trust scores, audit tables, and admin tools. See [Agentic Features Guide](docs/AGENTIC_FEATURES.md) for details.

---

## The web dashboard

**What it is:** A local website (default [http://localhost:4000](http://localhost:4000)) that shows what Guardian is doing.

**How it works:** When you run `pnpm dashboard:proxy`, the same process serves the dashboard and the API. The UI reads real data from your history database — not fake demo numbers.

**Main areas:**

| Area | What you see |
|------|----------------|
| **Protection** | Overall status and plain-English analysis of your setup. |
| **Activity** | Audit log of allowed and blocked calls. |
| **Threats** | Active threats and quarantine actions. |
| **Security** | Security score and trends. |
| **Operations** | Traffic, errors, and cost charts over time. |
| **Agentic AI** | Autonomous features: trust, threats, policy, operations, audit, and tools. |
| **Settings** | Servers, policy, and setup checklist. |

**Tip:** If charts say “no traffic in this time window,” widen the **Time window** dropdown (for example **Last 7 days**). Short windows only show very recent calls.

---

## Security Swarm (Pro)

**What it is:** A team of automated testers that keep trying to break your policy the way an attacker would.

**How it works:**

- One track **generates and runs attacks**, checks for bypasses, and writes reports.
- Another track **learns from real blocks** on your proxy and improves detection over time.
- The two tracks feed each other so tests get better as your deployment sees real traffic.

**Why it matters:** Your policy is only as strong as the attacks you have tested against; the swarm expands that set continuously.

Run: `pnpm security-swarm` (license required in production). See [docs](docs/) and diagram in `docs/assets/security-swarm-architecture.png`.

---

## Threat Lab (Pro)

**What it is:** Uses a local AI model to **propose** new attack patterns and rule ideas based on what Guardian has seen.

**How it works:**

1. Collects signals from recent blocks, CVE data, and swarm findings.
2. The model suggests new test cases and possible policy lines.
3. Automated checks validate proposals.
4. **You review and approve** — nothing is applied automatically.

Run: `pnpm security-swarm:threat-lab` (needs Ollama or another configured LLM). See [THREAT_LAB.md](docs/THREAT_LAB.md).

---

## Auto Threat Research (Pro)

**What it is:** Background research when something interesting is blocked.

**How it works:** When the proxy blocks a suspicious call, events can be queued, grouped, and analyzed by an LLM to classify the attack type and add it to your research corpus. **It does not change your live policy by itself** — it builds knowledge for you to use later.

Enable with `GUARDIAN_THREAT_RESEARCH_AUTO=true` when licensed.

---

## Guardian Autopilot (Pro)

**What it is:** One-command setup: wrap MCP configs, start the proxy, turn on the dashboard, and optional background services (digests, learning).

**How it works:**

```bash
pnpm autopilot:init -- --apply
pnpm autopilot:start
```

See [AUTOPILOT.md](docs/AUTOPILOT.md).

---

## Free vs Pro

| | **Free (community)** | **Pro** |
|---|---------------------|--------|
| Policy proxy and YAML rules | Yes | Yes |
| Attack blocking, audit log, cost tracking | Yes | Yes |
| Harness and real-life scenarios | Yes | Yes |
| Full enterprise dashboard | Limited / dev bypass | Yes |
| Security Swarm, Threat Lab, Autopilot | No | Yes |
| Fleet, SSO, Kubernetes, PostgreSQL | No | Yes |

Local development can use `GUARDIAN_CI_BYPASS_LICENSE=true` with `pnpm dashboard:proxy`. Production Pro needs a license — [PRO_SETUP.md](docs/PRO_SETUP.md).

---

## Quick start

### Install

```bash
npm install -g @mcp-guardian/server
```

### Easiest path: onboard

```bash
mcp-guardian onboard
```

Finds MCP configs for Cline, Claude Desktop, Cursor, and Windsurf, wraps your servers, and sets up Guardian as the proxy (~30 seconds).

### Run the proxy manually

```bash
mcp-guardian proxy --policy default-policy.yaml
```

### Dashboard + proxy together (recommended for development)

From the repo after `pnpm build`:

```bash
pnpm dashboard:proxy
```

Open **http://localhost:4000/**. Use the same history database for tests:

```bash
export MCP_GUARDIAN_DB_PATH="$HOME/.mcp-guardian/history.db"
pnpm real-life:filesystem    # short live attack smoke test
```

Details: [scenarios/real-life/README.md](scenarios/real-life/README.md).

### Useful commands

| Command | What it does |
|---------|----------------|
| `pnpm dashboard:proxy` | Proxy + dashboard on port 4000 |
| `pnpm autopilot:init` / `autopilot:start` | Wrap configs and start Autopilot |
| `pnpm analyze` | Print a plain-English security summary |
| `pnpm harness` | Offline policy attack matrix |
| `pnpm real-life:filesystem` | Live MCP attack smoke test |
| `mcp-guardian doctor` | Check your install and config |

---

## The policy file

Rules live in `default-policy.yaml` (or a path you set). Example:

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

The bundled default policy already blocks many common attack patterns. You can extend it or start from templates in `policy-templates/`. Full reference: [POLICY.md](docs/POLICY.md).

---

## Settings you might change

| Variable | Plain meaning |
|----------|----------------|
| `MCP_GUARDIAN_POLICY` | Path to your rules file |
| `MCP_GUARDIAN_DB_PATH` | Where call history is stored (share this between proxy and test runners) |
| `MCP_GUARDIAN_RETENTION_DAYS` | How long to keep audit rows (default 30) |
| `MCP_GUARDIAN_MAX_PAYLOAD_BYTES` | Max raw JSON-RPC message size (default 10MB) |
| `GUARDIAN_MAX_EXPANDED_PAYLOAD_BYTES` | Max serialized tool-argument size after decode (default 50MB) |
| `GUARDIAN_JWKS_REFRESH_MS` | How often to refresh OIDC JWKS (default 5 minutes) |
| `GUARDIAN_STRICT_ALLOWLIST_RBAC` | Require RBAC on `tools.allow` policy rules |
| `GUARDIAN_HEALTH_PROBE_INTERVAL_MS` | Periodic MCP health probes (0 = disabled) |
| `GUARDIAN_SHUTDOWN_GRACE_MS` | Wait for in-flight calls on shutdown (default 30s) |
| `GUARDIAN_DB_ENCRYPTION_KEY` | Encrypt sensitive audit fields at rest |
| `GUARDIAN_DB_ENCRYPT_AUDIT_ARGS` | Also encrypt redacted argument snippets in audit (`true` + key above) |
| `MCP_GUARDIAN_SIEM_ENABLED` | Export block/audit events to Splunk, Datadog, webhooks, etc. |
| `DASHBOARD_PORT` | Dashboard port (default `4000`) |
| `GUARDIAN_DAILY_BUDGET_USD` | Daily spend alert threshold |
| `GUARDIAN_LLM_PROVIDER` / `OLLAMA_BASE_URL` | Local AI for semantic checks and Threat Lab |
| `GUARDIAN_CI_BYPASS_LICENSE` | Local dev only: use dashboard without Pro license |

More: [ENTERPRISE_DEPLOYMENT.md](docs/ENTERPRISE_DEPLOYMENT.md) for teams, Redis, and multiple servers.

---

## Supported AI clients

Guardian can auto-discover and wrap configs for:

- **Cline** (VS Code)
- **Claude Desktop**
- **Cursor**
- **Windsurf**

Or pass any MCP config: `mcp-guardian proxy --config path/to/config.json`.

---

## Documentation map

| Topic | Document |
|-------|----------|
| Agentic AI features | [docs/AGENTIC_FEATURES.md](docs/AGENTIC_FEATURES.md) |
| Autopilot | [docs/AUTOPILOT.md](docs/AUTOPILOT.md) |
| Pro license | [docs/PRO_SETUP.md](docs/PRO_SETUP.md) |
| Policy reference | [docs/POLICY.md](docs/POLICY.md) |
| Enterprise deploy | [docs/ENTERPRISE_DEPLOYMENT.md](docs/ENTERPRISE_DEPLOYMENT.md) |
| Architecture | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Release history | [CHANGELOG.md](CHANGELOG.md) |

---

## License

**Community features** (proxy, policy, scanning, harness, real-life scenarios) are **MIT** — see [LICENSE](LICENSE) and [COMMUNITY_SCOPE.md](COMMUNITY_SCOPE.md).

**Pro features** require a license in production: [mcp-guardian-cloud.vercel.app](https://mcp-guardian-cloud.vercel.app). See [LICENSE-PRO](LICENSE-PRO).
