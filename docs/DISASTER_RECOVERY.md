# Disaster Recovery

RTO/RPO targets and restore procedures for self-hosted MCP Mastyf AI.

## Targets

| Component | RPO | RTO |
|-----------|-----|-----|
| Postgres policy + audit | 24h (nightly backup) | 2h |
| SQLite history (single-node) | 24h | 1h |
| Redis (rate limits / sessions) | Rebuild acceptable | 30m |
| Helm release config | Git-backed | 30m |

## SQLite restore

```bash
kubectl scale deployment mastyf-ai --replicas=0
kubectl cp backup/history-YYYYMMDD.db mastyf-ai-pod:/data/history.db
kubectl scale deployment mastyf-ai --replicas=3
mastyf-ai doctor
```

## Postgres restore (`pg_basebackup` / dump)

```bash
pg_restore -d mastyf_ai --clean --if-exists backup.dump
# Verify row counts
psql $DATABASE_URL -c "SELECT COUNT(*) FROM call_records;"
```

## Redis rebuild

Redis holds ephemeral rate-limit counters and DPoP jti store. After loss:

1. Redeploy Redis Sentinel/cluster per [REDIS_HA.md](./REDIS_HA.md)
2. Restart proxy pods — sessions re-established on next OAuth flow

## S3 backup sidecar

Set `backup.s3Bucket` in Helm enterprise overlay. CronJob uploads `history-YYYYMMDD.db` to `s3://$AWS_S3_BACKUP_BUCKET/`.

## DR drill

Quarterly: `scripts/dr-drill.sh` restores to temp DB and verifies row count smoke test.

Runbooks: [runbooks/postgres-outage.md](./runbooks/postgres-outage.md), [runbooks/policy-rollback.md](./runbooks/policy-rollback.md), [runbooks/cloud-deploy-rollback.md](./runbooks/cloud-deploy-rollback.md).
