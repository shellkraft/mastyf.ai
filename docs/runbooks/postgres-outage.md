# Postgres Outage Runbook

## Symptoms

- Readiness probe fails on `/readyz`
- `MASTYF_AI_REQUIRE_PGBOUNCER` startup errors
- Dashboard empty audit trail

## Steps

1. Check PgBouncer pods: `kubectl get pods -l app.kubernetes.io/component=pgbouncer`
2. Verify `DATABASE_URL` points to pooler `:6432`, not Postgres `:5432`
3. Failover to replica if using managed RDS — update ExternalSecret
4. Scale proxy to 1 replica temporarily if pool exhausted
5. Restore from backup per [DISASTER_RECOVERY.md](../DISASTER_RECOVERY.md)

RTO: 2h | RPO: 24h (nightly backup)
