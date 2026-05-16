# MCP Guardian Compliance Mapping

| Control area | Implementation |
|--------------|----------------|
| Audit logging | Structured JSON via pino; SIEM via `MCP_GUARDIAN_SIEM_*` env vars |
| Policy changes | `POLICY_AUDIT_ENABLED=true` → JSONL in PolicyAuditor |
| Authentication | OAuth 2.1 / OIDC JWT validation |
| Authorization | Policy RBAC (`rules[].rbac`) |
| HA state | `REDIS_URL` + optional `DB_TYPE=postgres` |
| DPoP replay (multi-replica) | `REDIS_URL` → Redis `SET NX` jti store (`dpop-nonce-store.ts`) |
| Secrets | `GUARDIAN_SECRET_PROVIDER` (env, Vault, AWS) |
| GDPR erasure | 30-day TTL purge in `history-db.ts`; operator must run DB-level `DELETE` for Article 17 erasure requests |

## Honest gaps (not certified without your controls)

| Requirement | Status |
|-------------|--------|
| **HIPAA at-rest encryption** | `history.db` is plain SQLite by default. Use encrypted volumes (EBS, LUKS), or external SQLCipher/KMS integration — not built into the OSS package. |
| **SOC2 evidence pack** | Audit logs exist; formal evidence bundle is operator-owned. |
| **GDPR purge in prod** | Requires real Postgres + scheduled purge job validation in your environment. |

See [PEN_TEST_SCOPE.md](./PEN_TEST_SCOPE.md) for security assessment scope.
