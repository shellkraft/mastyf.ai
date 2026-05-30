# Production blockers — MCP Guardian v2.8.0

Status as of **2.8.0** (production hardening bundle). Each item was verified with automated tests and Helm defaults.

**2.8.4+ enterprise fixes:** SSE HTTP+SSE lifecycle (`GET /sse`, `POST /message`), `evaluateAsync`, shared attack-learning PG (`GUARDIAN_AUDIT_SYNC_ENABLED` + `DATABASE_URL`), `GUARDIAN_SEMANTIC_STRICT`, migration runner (`schema_migrations`), per-tenant isolation (circuit breakers, rate limits, sessions, attack learning, audit). See [MULTI_TENANCY.md](./MULTI_TENANCY.md).

**Unreleased full-stack review:** stdin serial queue, HALF_OPEN single probe, JWT-authoritative tenant, DPoP in block mode (`GUARDIAN_LEGACY_NO_DPOP` escape hatch), WebSocket parity, OPA cache, policy shadow, idempotency, cert pinning, streamable HTTP MVP, SPIFFE socket — see [TRANSPORT.md](./TRANSPORT.md) and [SPIFFE.md](./SPIFFE.md).

**3.4.1 code-review fixes:** JWKS TTL refresh + signature retry, expanded payload caps (stdio/HTTP/SSE/streamable/WS), JSON-RPC `id: 0`, rate-limit persistence across hot-reload, strict allowlist RBAC, `MCP_GUARDIAN_RETENTION_DAYS`, `GUARDIAN_DB_ENCRYPT_AUDIT_ARGS`, SIEM on all block paths, CVE OSV/NVD dedup, Redis circuit-breaker sync + pubsub, semantic skip metrics, health probe scheduler (CLI + autopilot), graceful shutdown drain, transport agentic/payload parity.

Verify:

```bash
pnpm exec vitest run tests/auth/oauth-jwks-refresh.test.ts tests/proxy/payload-guard.test.ts tests/proxy/tool-call-pre-guard.test.ts
pnpm exec vitest run tests/policy/policy-watcher-reload.test.ts tests/policy/policy-allowlist-guard.test.ts
pnpm test:policy-proxy-utils
```

| # | Blocker | Priority | Was | Now | Evidence |
|---|---------|----------|-----|-----|----------|
| 1 | PgBouncer pool exhaustion | P0 | Direct `:5432` could exhaust Postgres under HA | Fail-fast + Helm enforcement | `src/utils/pgbouncer-check.ts` (`checkPgBouncerAtStartup` in `src/container.ts`); `GUARDIAN_REQUIRE_PGBOUNCER`; Helm `pgbouncer.requireGuardianEnforcement: true` → `deploy/helm/mcp-guardian/values.yaml`, `templates/deployment.yaml`; `tests/utils/pgbouncer-check.test.ts` |
| 2 | Memory leak (8h+ sessions) | P0 | Hot LRU keys could extend TTL indefinitely | All LRU caches use `updateAgeOnGet: false` + max entries; periodic session sweep; heap monitor on proxy start | `policy-engine.ts`, `proxy-server.ts`, `llm-cache.ts`, `session-cache.ts`, `cve-checker.ts`; `startMemoryMonitor` in `proxy-server.ts` (`GUARDIAN_MEMORY_MONITOR=false` to disable); `tests/policy/policy-engine-memory.test.ts`, `tests/utils/memory-monitor.test.ts` |
| 3 | DPoP multi-replica race | P1 | In-memory jti store per pod | Redis `SET NX` + short distributed lock | `src/auth/dpop-nonce-store.ts` (`claimDpopJtiOnRedis`); `GUARDIAN_REQUIRE_DPOP` + `REDIS_URL` — [PRODUCTION_AUTH.md](./PRODUCTION_AUTH.md); `tests/auth/dpop-redis-lock.test.ts` |
| 4 | Cost auditor audit mode | P1 | Audit simulated token volumes without proxy traffic | Default **model-only** ($0 measured); `actual` from `call_records`; estimates opt-in | `src/utils/cost-estimate.ts` (`allowsCostEstimates`); `tests/services/cost-auditor-audit-mode.test.ts`, `tests/integration/full-pipeline.test.ts` |
| 5 | Plugin SDK npm publish | P2 | Monorepo-only path | `@mcp-guardian/plugin-sdk` package with `exports`, `prepublishOnly` build; workspace import documented | `packages/plugin-sdk/package.json`, [PLUGIN_SDK.md](./PLUGIN_SDK.md) |

## Quick verification

```bash
pnpm test
pnpm --filter @mcp-guardian/plugin-sdk run build
```

### PgBouncer (blocker #1)

```bash
export DB_TYPE=postgres
export DATABASE_URL=postgresql://u:p@postgres:5432/guardian
export GUARDIAN_REQUIRE_PGBOUNCER=true
node -e "import('./dist/container.js').then(()=>{})"  # exits 1 after build
```

### DPoP + Redis (blocker #3)

```bash
export GUARDIAN_REQUIRE_DPOP=true
export REDIS_URL=redis://localhost:6379
```

### Cost audit without estimates (blocker #4)

```bash
# Default: model-only, no fabricated usage
mcp-guardian audit --server my-server
# Opt-in legacy simulation:
GUARDIAN_COST_ALLOW_ESTIMATES=true mcp-guardian audit --server my-server
```

## Helm production defaults

- `pgbouncer.requireGuardianEnforcement: true` when using Postgres
- `config.env.GUARDIAN_STRICT_MODE: "true"`
- `redis.enabled: true` (or external Sentinel URL)
- `dpop.require: true` for sender-constrained OAuth (optional values key)

See [SCALE_AND_RESILIENCE.md](./SCALE_AND_RESILIENCE.md) and [deploy/PRODUCTION.md](../deploy/PRODUCTION.md).
