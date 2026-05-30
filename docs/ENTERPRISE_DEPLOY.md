# Enterprise deployment guide

Operational checklist for **self-hosted** MCP Guardian at enterprise scale. Code hardening is shipped in v2.8+; this document covers **configuration you must apply**.

Related: [ENTERPRISE_READINESS.md](./ENTERPRISE_READINESS.md) · [SCALE_AND_RESILIENCE.md](./SCALE_AND_RESILIENCE.md) · [PRODUCTION_AUTH.md](./PRODUCTION_AUTH.md) · [MULTI_TENANCY.md](./MULTI_TENANCY.md) · [deploy/PRODUCTION.md](../deploy/PRODUCTION.md)

## Quick start (Kubernetes)

```bash
helm upgrade --install mcp-guardian ./deploy/helm/mcp-guardian \
  -f deploy/helm/mcp-guardian/values.yaml \
  -f deploy/helm/mcp-guardian/values-enterprise.yaml \
  --set database.url="$DATABASE_URL" \
  --set redis.sentinel.sentinels="$REDIS_SENTINELS" \
  --set secrets.existingSecret=mcp-guardian-prod
```

Verify before cutover:

```bash
# Unset local-dev overrides before preflight (dashboard:proxy sets DASHBOARD_AUTH_DISABLED=true)
env -u DASHBOARD_AUTH_DISABLED ./scripts/verify-enterprise-preflight.sh
# or: pnpm enterprise:preflight  (fails if DASHBOARD_AUTH_DISABLED=true in your shell)
```

## P0 — Required

| Item | Configuration |
|------|----------------|
| Block enforcement | `policy.mode: block`, `default_action: block` — roll out via `policy-audit.yaml` → `policy-warn.yaml` → `default-policy.yaml` |
| Postgres HA | `DB_TYPE=postgres`, `DATABASE_URL` through **PgBouncer** (`:6432`), `GUARDIAN_REQUIRE_PGBOUNCER=true` |
| Redis | `REDIS_URL` or Sentinel (`REDIS_SENTINELS` + `REDIS_SENTINEL_MASTER_NAME`), `GUARDIAN_STRICT_MODE=true` |
| Single region | Do **not** run Redis active-active across regions (>80ms RTT breaks locks) |
| Dashboard auth | `DASHBOARD_AUTH_DISABLED=false`, `DASHBOARD_API_KEY` or JWT + `GUARDIAN_DASHBOARD_ROLES` |
| Network | Restrict dashboard `:4000` with `dashboard.allowedCidr` or ingress + TLS |

## P1 — Strongly recommended

| Item | Configuration |
|------|----------------|
| Multi-tenant JWT | `GUARDIAN_MULTI_TENANT_ENABLED=true`, JWT `tenant_id` claim (`GUARDIAN_JWT_TENANT_CLAIM`) |
| Postgres RLS | `GUARDIAN_PG_RLS_ENABLED=true` with `DB_TYPE=postgres` (enterprise Helm default) |
| Immutable audit chain | `GUARDIAN_AUDIT_HASH_CHAIN=true` — [HIPAA_AUDIT_TRAIL.md](./HIPAA_AUDIT_TRAIL.md) |
| Semantic LLM cap | `GUARDIAN_SEMANTIC_LLM_MAX_PER_MIN=10`, `GUARDIAN_SEMANTIC_LLM_MAX_USD_PER_MIN` (optional explicit USD/min; default = count × `GUARDIAN_SEMANTIC_ESTIMATED_COST_USD`), `GUARDIAN_LLM_CACHE_TTL_SEC=86400` |
| DPoP lock-free | `GUARDIAN_DPOP_LOCK_FREE=true` (jittered SET NX; set `legacy` for lock-based path) |
| DPoP | `GUARDIAN_REQUIRE_DPOP=true` + Redis for jti dedup |
| Cost governance | Merge `policy-templates/enterprise-cost-governance.yaml`, `GUARDIAN_DAILY_BUDGET_USD` |
| SIEM | Structured JSON logs; `MCP_GUARDIAN_SIEM_*` exporters (see below) |
| Observability | Helm `monitoring.serviceMonitor.enabled`, alert on `/readyz` and `mcp_guardian_proxy_latency_ms` p99 |
| Encoding guard | `GUARDIAN_ENCODING_GUARD=true` (default on) — blocks base64/obfuscation evasions on allowlisted tools |

## Response security (stdio / SSE / WebSocket)

All MCP transports share `gateToolResponseText()` (DLP, chunked inspection, optional sync semantic).

| Variable | Default | Purpose |
|----------|---------|---------|
| `GUARDIAN_RESPONSE_DLP_MODE` | `block` | `block` \| `redact` \| `audit` — scrub-and-pass vs hard block |
| `GUARDIAN_SKIP_RESPONSE_SCAN` | off | Skip response inspection for trusted upstream |
| `GUARDIAN_SEMANTIC_SYNC_RESPONSE` | **on in production** (opt out with `false`) | Sync heuristic gate on tool **responses** — required for enterprise response security |
| `GUARDIAN_SEMANTIC_SYNC_RESPONSE_LLM` | off | Add LLM pass (latency); needs API key |
| `GUARDIAN_SEMANTIC_SYNC_TIMEOUT_MS` | `3000` | LLM timeout for sync response gate |
| `GUARDIAN_LOCAL_SEMANTIC` | on | Heuristic scorer when LLM absent |
| `GUARDIAN_TENANT_SEMANTIC_JSON` | — | Per-tenant `syncResponse`, `asyncAudit`, `strict`, etc. |
| `GUARDIAN_SEMANTIC_ASYNC` | off (set `true` in enterprise Helm) | Post-hoc LLM audit; lowers p99 vs sync semantic |
| `GUARDIAN_TENANT_DAILY_BUDGET_JSON` | — | Per-tenant USD caps enforced before semantic LLM |
| `GUARDIAN_GATEWAY_MODE` | off | SSE/WebSocket-only shared ingress (no stdio children) |
| `GUARDIAN_SWARM_EVASION_SIGNING_KEY` | — | HMAC verify for `evasion-promotions.json` in CI |
| `GUARDIAN_STREAMABLE_HTTP_UPSTREAM_RELAY` | off | POST `/mcp` relay + response gate for streamable HTTP proxy |

## OAuth hardening

| Variable | Default | Purpose |
|----------|---------|---------|
| `GUARDIAN_JWT_MAX_LIFETIME_SEC` | `86400` | Reject over-long JWTs |
| `GUARDIAN_TOKEN_REVOCATION` | on | In-memory denylist (`revokeBearerToken`) |
| `GUARDIAN_TOKEN_REVOCATION_REDIS` | on when `REDIS_URL` | Cluster-wide revocation |
| `GUARDIAN_TOKEN_REVOCATION_TTL_MS` | `86400000` | Denylist entry TTL |
| `GUARDIAN_OIDC_INTROSPECTION` | off | RFC 7662 `active` check after JWT verify |
| `GUARDIAN_OIDC_INTROSPECTION_FAIL_OPEN` | off | Allow on introspection outage |
| `GUARDIAN_OIDC_CLIENT_ID` | — | Introspection client id |
| `GUARDIAN_OIDC_CLIENT_SECRET` | — | Introspection client secret |

## mTLS upstream (HTTP / SSE)

| Variable | Default | Purpose |
|----------|---------|---------|
| `MCP_TLS_ENABLED` | off | Mutual TLS to upstream MCP |
| `MCP_TLS_CA` / `MCP_TLS_CERT` / `MCP_TLS_KEY` | — | PEM paths |
| `GUARDIAN_MTLS_HOT_RELOAD` | on | `MtlsCertWatcher` reloads `getMtlsAgent()` |

Proxies resolve the shared agent per request so cert rotation does not require pod restart.

## Audit integrity

| Variable | Default | Purpose |
|----------|---------|---------|
| `GUARDIAN_AUDIT_HASH_CHAIN` | off | SHA-256 chained JSONL for `PolicyAuditor` (`POLICY_AUDIT_ENABLED=true`) |
| `GUARDIAN_AUDIT_HASH_CHAIN_SIEM` | on when chain enabled | Mirror `tool_blocked` / `policy_decision` events to chained SIEM JSONL |
| `GUARDIAN_AUDIT_HASH_CHAIN_SIEM_LOG` | `~/.mcp-guardian/siem-audit-chained.jsonl` | Chained SIEM trail path |
| `GUARDIAN_SESSION_ROTATE_ON_USE` | off | Rotate MCP session token; WS injects `result._meta.sessionToken` |
| `POLICY_AUDIT_LOG` | `./policy-audit.jsonl` | Policy change trail path |

Verify with `verifyChainedJsonlLines()` in `src/utils/audit-hash-chain.ts` or your SIEM importer.

### SIEM exporters (`MCP_GUARDIAN_SIEM_*`)

| Variable | Description |
|----------|-------------|
| `MCP_GUARDIAN_SIEM_ENABLED` | `true` to enable exporter pipeline |
| `MCP_GUARDIAN_SIEM_EXPORTERS` | Comma list: `splunk`, `datadog`, `webhook`, `elastic`, etc. |
| `MCP_GUARDIAN_SIEM_SPLUNK_HEC_URL` | Splunk HEC endpoint |
| `MCP_GUARDIAN_SIEM_SPLUNK_HEC_TOKEN` | Splunk HEC token |

Policy blocks and denials emit `tool_blocked` via `StructuredLogger.logBlocked()` on stdio, HTTP, SSE, WebSocket, and streamable HTTP transports.

## P2 — Compliance and ops

| Item | Reference |
|------|-----------|
| Encryption at rest | [COMPLIANCE.md](./COMPLIANCE.md), [ENCRYPTION_AT_REST.md](./ENCRYPTION_AT_REST.md) |
| Backup / restore | [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md), [RUNBOOK.md](./RUNBOOK.md) |
| GDPR erasure | `HistoryDatabase.eraseAllAuditData()` — [COMPLIANCE.md](./COMPLIANCE.md) |
| Evidence pack | `pnpm enterprise:evidence-pack` → [ENTERPRISE_EVIDENCE_PACK.md](./ENTERPRISE_EVIDENCE_PACK.md) |

## Policy rollout (IDE + gateway)

1. Week 1: `policy-audit.yaml` — observe blocks, tune FP whitelist via dashboard.
2. Week 2: `policy-warn.yaml` — alert without hard block where needed.
3. Production: `default-policy.yaml` + workspace/path restrictions (`GUARDIAN_WORKSPACE`).

For developer laptops: `pnpm onboard -- --client cursor --apply` then shared `MCP_GUARDIAN_DB_PATH` for fleet visibility.

## What is not included

- Hosted SaaS control plane (v3 roadmap)
- SOC2 / FedRAMP attestation packages (customer compliance program)
- Multi-region active-active Redis/Postgres

See [ENTERPRISE_ROADMAP.md](./ENTERPRISE_ROADMAP.md).
