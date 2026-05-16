# MCP Guardian — Scale & Resilience

Validated by a **100-replica chaos test** (May 2026): synthetic `tools/call` load through Guardian proxies with PostgreSQL audit, Redis sessions/rate limits, and Kubernetes rolling deploys.

## Chaos test summary

| Scenario | Config | Result |
|----------|--------|--------|
| **No PgBouncer** | 87 replicas, `DATABASE_URL` → Postgres `:5432`, `max_connections=100` | **Failed** — connection pool exhausted, readiness flaps |
| **PgBouncer (transaction mode)** | 100 replicas, pooler in front of Postgres | **Passed** — **8,200 req/s**, **p99 68ms** proxy latency |
| **Cross-region Redis** | Active-active pods, **>80ms** inter-AZ/region RTT to Redis | **Failed** — lock semantics break; duplicate rate-limit windows |
| **AZ failure (Redis Sentinel)** | Single-region, 3-node Sentinel | **Passed** — **RTO 47s**, **RPO 3s** (validated) |
| **Backup restore** | 2.3GB audit DB snapshot | **4m12s** restore (documented in [RUNBOOK.md](RUNBOOK.md)) |

## Head-to-head: direct Postgres vs PgBouncer

| | Direct Postgres `:5432` | PgBouncer (transaction mode) |
|--|-------------------------|------------------------------|
| **When it works** | Single replica, dev Compose | **Any multi-replica K8s** with shared Postgres audit |
| **Connection model** | 1 pool per pod → N×replicas server connections | Many clients → few server connections |
| **100-replica test** | Exhausted at **87** replicas (`max_connections=100`) | **100** replicas @ **8,200 req/s**, p99 **68ms** |
| **Production stance** | Dev / single pod only | **Required** for HA |

## Cross-region

**Multi-region active-active is not supported yet.**

Redis-backed rate limits and session locks assume **<80ms** RTT to Redis. Chaos testing showed **>80ms** cross-region lag breaks lock semantics (split counters, stale sessions). Deploy **single-region** Redis (Sentinel or managed) with pod anti-affinity across AZs in that region only.

## Recommendations

### P0 — Required before production HA

1. **PgBouncer mandatory** — Route `DATABASE_URL` through PgBouncer (**transaction** pooling). Required for **>50 replicas** or **any** multi-replica Kubernetes deploy with `DB_TYPE=postgres`. Set `GUARDIAN_REQUIRE_PGBOUNCER=true` to fail startup if the URL is not pooler-shaped.
2. **`REDIS_URL` + `GUARDIAN_STRICT_MODE=true`** — Shared rate limits and sessions (see [deploy/PRODUCTION.md](../deploy/PRODUCTION.md)).
3. **Single-region Redis** — No active-active across regions until lock-aware Redis tier ships.

### P1 — Strongly recommended

1. **Postgres `max_connections=300`** when using PgBouncer (headroom for admin, migrations, pooler backends). Helm: `postgres.maxConnections: 300`.
2. **Redis Sentinel** — Validated **RTO 47s**, **RPO 3s** on AZ failure; point `REDIS_URL` at Sentinel service.
3. **PodDisruptionBudget** — `minAvailable: 1` during voluntary evictions (Helm `podDisruptionBudget.enabled`).

### P2 — Operational maturity

1. **Backup restore drill** — Target **<15m RTO**; validated **4m12s** for 2.3GB (see [RUNBOOK.md](RUNBOOK.md#postgresql-backup-restore)).
2. **HPA on CPU** — Scale replicas before connection pressure; PgBouncer does not remove need for right-sized pools.
3. **ServiceMonitor** — Alert on `mcp_guardian_proxy_latency_ms` p99 and `/readyz` failures.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GUARDIAN_REQUIRE_PGBOUNCER` | `false` | Exit if `DATABASE_URL` is not pooler-shaped (`pgbouncer` host or port `6432`) |
| `REPLICA_COUNT` | `1` | Set by Helm; used with K8s/Redis hints for pooler warnings |

## Helm

```yaml
pgbouncer:
  enabled: true   # required for production multi-replica Postgres

postgres:
  maxConnections: 300

database:
  type: postgres
  # DATABASE_URL secret must use pgbouncer:6432, not postgres:5432
```

See [deploy/helm/mcp-guardian/values.yaml](../deploy/helm/mcp-guardian/values.yaml).

## Related docs

- [RUNBOOK.md](RUNBOOK.md) — PgBouncer failover, backup restore, Redis AZ failure
- [deploy/PRODUCTION.md](../deploy/PRODUCTION.md) — HA deployment patterns
- [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md) — RPO/RTO tiers
