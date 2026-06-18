# MCP Guardian / Mastyf AI

**Security, cost, and health governance platform for MCP (Model Context Protocol) infrastructure.**

Mastyf AI is a zero-trust gateway that sits between AI agents and MCP servers, intercepting every tool call to enforce policy, detect threats, audit costs, and monitor health. Think of it as a **WAF + API Gateway + Observability platform for AI agent tool calls**.

[![npm version](https://img.shields.io/npm/v/@mastyf-ai/server)](https://www.npmjs.com/package/@mastyf-ai/server)
[![npm downloads](https://img.shields.io/npm/dm/@mastyf-ai/server)](https://www.npmjs.com/package/@mastyf-ai/server)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## Overview

| Capability | Description |
|---|---|
| **Security** | Three-layer detection (regex + schema + LLM), CVE scanning, secrets detection, typo-squat detection, prompt injection, command AST analysis, response DLP |
| **Policy enforcement** | YAML-based engine with tool allow/deny lists, regex patterns, rate limits, token budgets, RBAC, hot-reload |
| **Authentication** | OAuth 2.1 / OIDC, JWT with algorithm pinning, DPoP (RFC 9449), mTLS, RBAC |
| **Cost governance** | Real token counting (tiktoken), 2,138+ models across 17 providers, per-tool cost breakdown |
| **Health monitoring** | JSON-RPC probes, circuit breaker, Prometheus metrics, OpenTelemetry, WebSocket dashboard |
| **Agentic AI** | 44+ modules: threat prediction, auto-policy generation, honeypots, compliance evidence, drift detection, RL-based adaptation (Thompson Sampling, SARSA, REINFORCE) |
| **Autonomous security swarm** | Multi-agent red-teaming system with continuous bypass detection and corpus evaluation |
| **Adversarial harness** | Python + Node.js attack framework with mutation/combination engine and evasion corpus |

---

## Monorepo Structure

```
mcp-guardian/
├── apps/
│   ├── cloud/              # Next.js 15 SaaS app (Drizzle ORM, Postgres, NextAuth)
│   └── proxy-core/         # Go high-performance data plane proxy
├── packages/
│   ├── core/               # @mastyf-ai/core — Detection engine (regex, schema, semantic)
│   ├── server/             # @mastyf-ai/server — Runtime security proxy
│   ├── cli/               # @mastyf-ai/cli — CLI binary for scanning MCP tool definitions
│   ├── plugin-sdk/         # @mastyf-ai/plugin-sdk — Stable detector plugin SDK
│   └── mtx/                # @mastyf-ai/mtx — MCP Threat Exchange format
├── src/                    # Main application source
│   ├── index.ts            # MCP server entry point (stdio-based, exposes 40+ tools)
│   ├── cli.ts              # Commander-based CLI entry point
│   ├── container.ts        # Dependency injection container
│   ├── proxy/              # Proxy management (stdio, SSE, WebSocket, HTTP, gateway)
│   ├── policy/             # Policy engine, guards, watchers
│   ├── scanners/           # CVE, secrets, typo-squat, prompt injection scanning
│   ├── ai/                 # AI learning, semantic analysis, threat intelligence
│   ├── agentic/            # 44+ agentic AI modules
│   ├── control-plane/      # Control plane server, compiled rules, policy distribution
│   ├── auth/               # OAuth/OIDC/API key authentication
│   ├── dashboard/          # Dashboard REST API + embedded SPA
│   └── database/           # SQLite + Postgres DB layers
├── security-swarm/         # Autonomous security swarm agents
├── adversarial-harness/    # Python + Node.js adversarial attack framework
├── corpus/                 # Attack/benign/edge-case evaluation corpus
├── scenarios/              # Real-life attack scenarios
├── benchmarks/             # Performance benchmarks
├── config/                 # Configuration templates
├── policy-templates/       # Policy YAML templates
├── installer/              # Windows installer
├── scripts/                # Utility and CI scripts
└── tests/                  # Comprehensive test suite (45+ test directories)
```

---

## Quick Start

```bash
# Install globally
npm install -g @mastyf-ai/server

# Scan MCP servers for CVEs, secrets, and injection attacks
mastyf-ai scan --all

# Proxy with active policy enforcement
mastyf-ai proxy --policy ./default-policy.yaml --blocking-mode block

# Generate a full security-cost-health report
mastyf-ai report --all --format markdown --output report.md

# Run as an MCP server (AI agents can self-audit)
mastyf-ai
```

### From source

```bash
git clone https://github.com/mastyf-ai/mastyf-ai.git
cd mastyf-ai
pnpm install
pnpm build
pnpm start
```

---

## Architecture

Mastyf AI employs a **multi-layer detection + policy enforcement + agentic AI** architecture:

### Detection Layers

| Layer | What it catches |
|---|---|
| **Payload normalization** | Hex escaping, Unicode escapes, URL encoding, HTML entities, shell obfuscation |
| **Regex triage** | Cross-tool chaining, privilege escalation, exfiltration, shell injection (38 patterns, 8 categories) |
| **Schema analysis** | Injection in parameter defaults, suspicious parameter names, enum injection |
| **Shell AST** | Command substitution, pipe chains, redirects, 33 dangerous commands, Unicode homoglyphs |
| **LLM semantic** | Context-aware verdict on tool descriptions — catches adversarial intent regex can't see |
| **Secret patterns + entropy** | 50+ named regex patterns + Shannon entropy for base64/hex secrets |
| **Policy engine** | Tool denylists, regex patterns, rate limits, token budgets, RBAC, default-deny |
| **Response inspection** | Prompt injection in tool responses, data exfiltration, base64 payloads |

### Control Plane / Data Plane

The **control plane** (Node.js) compiles human-readable YAML policies into machine-optimized rule sets and distributes them. The **data plane** (Go, `apps/proxy-core/`) is a high-performance reverse proxy that evaluates tool calls against compiled rules with minimal latency, polling the control plane every 3 seconds.

### Proxy Modes

- **stdio** — Wraps stdio-based MCP servers
- **SSE** — Server-Sent Events transport
- **WebSocket** — WebSocket transport
- **Streamable HTTP** — HTTP streaming
- **Gateway** — Multi-tenant shared ingress

### Data Flow

```
AI Client ──JSON-RPC──→ Proxy ──Policy Engine──→ Upstream MCP Server
                           │                         │
                     HistoryDatabase           Security Scanner
                     (SQLite WAL)              Cost Auditor
                                               Health Monitor
```

1. AI client sends `tools/call` JSON-RPC to proxy
2. Proxy validates JWT identity (algorithm-pinned, audience/issuer-checked)
3. Policy engine evaluates context → block/flag/pass
4. If passed, forwards to upstream MCP server; if blocked, returns JSON-RPC error
5. Records call metadata (tokens, duration, agent ID) to SQLite
6. Circuit breaker monitors upstream health
7. Dashboard receives real-time events; Prometheus scrapes `/metrics`

---

## Features

### Security Scanning

- **CVE checking** — OSV.dev + NVD with transitive dependency tree scanning (200+ packages), LRU caching
- **Secrets scanning** — 50+ patterns (OpenAI, Anthropic, GitHub, AWS, GCP, Azure, Stripe, and more) plus Shannon entropy analysis
- **Typo-squatting detection** — Levenshtein distance against known MCP server names
- **Authentication probing** — Missing auth, unencrypted transport detection
- **Prompt injection detection** — Scans tool call arguments for injection payloads
- **Response DLP** — Scans MCP responses for PII, credentials, data leaks

### Policy Engine

YAML-based policies evaluated against every `tools/call` in real time:

```yaml
version: '1.0'
policy:
  mode: block
  default_action: block
  rules:
    - name: block-shell-injection
      action: block
      patterns:
        - curl\s|wget\s
        - rm\s+-rf
        - '&&|\|\|'
    - name: deny-dangerous-tools
      action: block
      tools:
        deny: [execute_command, bash, sh, eval, exec]
    - name: rate-limit-tool-calls
      action: flag
      maxCallsPerMinute: 120
```

Hot-reload: edit the YAML and the engine swaps atomically without restart.

### Cost Governance

- Real token counting via `tiktoken` (o200k_base)
- 17 providers, 2,138+ models with live pricing via litellm
- Per-tool token, duration, and cost breakdown
- Cost efficiency scoring (weighted: security 40%, health 30%, cost 30%)

### Health & Observability

- Live JSON-RPC probes (latency, success rate, tool count)
- Circuit breaker (CLOSED / OPEN / HALF_OPEN)
- Prometheus metrics, OpenTelemetry tracing, pino structured logging
- `/healthz` and `/readyz` endpoints for K8s
- WebSocket dashboard with real-time push
- Discord webhook alerting with severity filtering

### Authentication & Zero Trust

- OAuth 2.1 / OIDC — JWT validation, algorithm pinning, audience/issuer validation
- DPoP (RFC 9449) — Sender-constrained tokens for replay-proof auth
- RBAC — Scope-based and client-ID-based access control
- mTLS — Mutual TLS for proxy ↔ upstream

### Agentic AI (44+ modules)

| Module | Description |
|---|---|
| Threat Prediction | 30/90/365-day risk forecasts with preemptive hardening |
| Policy Generation | Observe agent behavior, auto-generate minimal-privilege policies |
| Threat Intel Mesh | Anonymized cross-deployment threat intelligence sharing |
| Honeypots | Deploy fake MCP servers to trap adversaries |
| Supply Chain Verification | Signed attestation, SBOM export, dependency confusion detection |
| Compliance Evidence | SOC2, HIPAA, PCI-DSS, FedRAMP, ISO27001 evidence generation |
| Drift Detection | Baseline capture and behavioral drift detection |
| Red Team | Autonomous attack generation, policy A/B testing |
| Trust Score | A+–F security rating (like SSL Labs for MCP) |
| Response DLP | Scan tool responses for data leaks |
| RL Suite | Thompson Sampling, LinUCB, SARSA, REINFORCE |
| Collusion Detection | Agent-to-agent collusion detection |
| Protocol Fuzzer | MCP protocol fuzzing |
| Insurance Risk | Annualized Loss Expectancy (ALE) calculation |
| Certification | Bronze/Silver/Gold/Platinum server certification |

### Autonomous Security Swarm

A continuous red-teaming system with specialized agents:

- **Scout** — Supply-chain signal (`pnpm audit`)
- **Corpus** — 228-entry evaluation benchmark
- **Evasion** — Custom probes + bypass generation
- **Threat Lab** — LLM-powered discovery (optional, Pro)
- **Parity** — Node ↔ Python agreement verification
- **Proxy** — Live stdio MCP via adversarial harness

---

## CLI Reference

### `mastyf-ai scan`
```bash
mastyf-ai scan --all                           # Scan all MCP configs
mastyf-ai scan --config ./mcp.json             # Scan a specific config
mastyf-ai scan --fail-on-critical              # Exit 1 on CRITICAL CVE
```

### `mastyf-ai audit`
```bash
mastyf-ai audit --all                          # Audit costs for all servers
mastyf-ai audit --threshold-cost 0.01           # Exit 2 if cost exceeds $0.01
```

### `mastyf-ai proxy`
```bash
mastyf-ai proxy --policy ./policy.yaml --blocking-mode block
mastyf-ai proxy --policy ./policy.yaml --dry-run      # Simulate
```

### `mastyf-ai report`
```bash
mastyf-ai report --all --format markdown --output report.md
```

### Additional commands
`start`, `wrap`, `onboard`, `setup`, `doctor`, `tui`, `control-plane`, `analyze`, `autopilot`, `policy test`, `threat-model`, `fleet status`, `bench`, `ai rollback`

---

## MCP Server Integration

Add to your MCP client config:

```json
{
  "mcpServers": {
    "mastyf-ai": {
      "command": "npx",
      "args": ["@mastyf-ai/server"]
    }
  }
}
```

Exposes tools: `scan_security`, `audit_costs`, `check_health`, `full_report`, `scan_prompt_injection`, `predict_threats`, `verify_supply_chain`, `detect_drift`, `deploy_honeypot`, `compute_trust_score`, and 30+ more.

---

## Production Deployment

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

Includes liveness/readiness probes, resource limits, security context (non-root, read-only filesystem), NetworkPolicy, and ExternalSecrets support.

---

## Development

```bash
pnpm install
pnpm build

# Tests
pnpm test
pnpm test:coverage
pnpm typecheck

# Corpus evaluation
pnpm eval

# Security swarm
pnpm security-swarm:fast
pnpm security-swarm:analyze
```

---

## License

- **Community Edition** — MIT ([LICENSE](LICENSE))
- **Pro/Enterprise** — Commercial license ([LICENSE-PRO](LICENSE-PRO))

---

## Built With

TypeScript, Go, pnpm, Turborepo, better-sqlite3, pino, prom-client, jose, shell-quote, tiktoken, commander, Next.js, Drizzle ORM, and more.
