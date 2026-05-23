# Community Scope (MIT)

The following are **free** under the [MIT License](LICENSE) without a Pro license key.

## Runtime (Community)

- MCP stdio / HTTP / SSE proxy with YAML policy (regex, schema, block mode)
- CLI: `scan`, `report`, `health`, `policy test`, `wrap`, `onboard` (non-fleet)
- Local policy files (`policy-templates/`, tenant YAML on disk)
- Adversarial harness and corpus evaluation (`adversarial-harness/`, `corpus/`)
- Core policy engine in `packages/core/` and `src/policy/` (sync path)

## Explicitly NOT in Community Scope (Pro — see [LICENSE-PRO](LICENSE-PRO))

| Area | Path / feature |
|------|----------------|
| Security Swarm CLI | `security-swarm/` (run.mjs, run-analysis.mjs, agents) |
| Dashboard Pro APIs | `src/utils/dashboard-server.ts` (most `/api/*` when licensed) |
| Dashboard SPA | `deploy/dashboard-spa/` (when served as Pro product) |
| WebSocket live feed | `src/dashboard/ws-broadcaster.ts` |
| AI attack learning | `src/ai/block-learning.ts`, instant learning, suggestion engine on proxy |
| Async semantic tier-2 | `src/ai/async-semantic-audit.ts` |
| Multi-tenant JWT binding | `GUARDIAN_MULTI_TENANT_ENABLED` + JWT tenant enforcement |
| Fleet CLI / TUI fleet | `mcp-guardian fleet`, TUI Fleet tab |
| Cloud license service | `apps/cloud` (operator-hosted; validates buyer keys) |

## v3.0 enforcement

Pro Features call the control plane (`GUARDIAN_CONTROL_PLANE_URL`) with
`GUARDIAN_LICENSE_KEY`. Security Swarm scripts exit unless licensed (CI sets
`GUARDIAN_CI_BYPASS_LICENSE=true` only in upstream workflows).

Maintainer local dev: `NODE_ENV=development` + `GUARDIAN_DEV_UNLOCK_ALL=true` (never in production).
