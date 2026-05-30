# Encryption at rest

Guardian stores audit history in SQLite (`MCP_GUARDIAN_DB_PATH`) or PostgreSQL (`DATABASE_URL`). Use layered controls in production.

## SQLite

### Option A — SQLCipher (`GUARDIAN_DB_ENCRYPTION_KEY`)

Set a strong passphrase before first open:

```bash
export GUARDIAN_DB_ENCRYPTION_KEY="$(openssl rand -base64 32)"
export MCP_GUARDIAN_DB_PATH=/var/lib/mcp-guardian/guardian.db
```

On open, Guardian runs `PRAGMA key = '…'`. This requires a **SQLCipher-enabled** `better-sqlite3` build (standard npm builds use stock SQLite and will log a warning; use field encryption or disk encryption below).

Rotate by re-keying with SQLCipher export/import or restore from backup after updating the key.

### Option B — Field encryption (always available)

When `GUARDIAN_DB_ENCRYPTION_KEY` is set, sensitive columns (e.g. `call_records.block_reason`) are encrypted with AES-256-GCM (`genc3:` prefix). Works on any SQLite build.

Set `GUARDIAN_DB_ENCRYPT_AUDIT_ARGS=true` to also encrypt redacted `call_records.argument_snippet` values. **Tool arguments are not a substitute for full secret management** — use encryption keys, disk encryption, and minimize what you log.

Without `GUARDIAN_DB_ENCRYPTION_KEY`, audit fields remain plaintext even when `GUARDIAN_DB_ENCRYPT_AUDIT_ARGS=true`.

### Option C — Disk / volume encryption (recommended baseline)

- **Linux:** LUKS on the volume hosting `MCP_GUARDIAN_DB_PATH`
- **Kubernetes:** encrypted PVC (cloud provider KMS)
- **macOS:** FileVault

No Guardian code change required.

## PostgreSQL

- Enable **RDS / Cloud SQL encryption at rest** (default on most managed offerings)
- TLS in transit: `sslmode=require` in `DATABASE_URL`
- Restrict network access; rotate `DATABASE_URL` credentials via your secret manager

## Redis

- Use **`rediss://`** URLs or set `GUARDIAN_REDIS_TLS=true` to upgrade `redis://` to TLS ([REDIS_HA.md](./REDIS_HA.md))
- Optional: `GUARDIAN_REDIS_TLS_REJECT_UNAUTHORIZED=false` only for dev with self-signed certs

## Key management

| Secret | Purpose |
|--------|---------|
| `GUARDIAN_DB_ENCRYPTION_KEY` | SQLCipher PRAGMA + field encryption |
| `DASHBOARD_JWT_SECRET` / `DASHBOARD_API_KEY` | Dashboard auth |
| DPoP / session material | Redis-backed jti store |
| `REDIS_PASSWORD` | Redis AUTH |

Store keys in Vault, AWS Secrets Manager, or Kubernetes secrets — never in git.

## Compliance

GDPR erasure: `HistoryDatabase.eraseAllAuditData([tenantId])` — see [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md).
