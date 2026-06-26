# Multi-replica deployment guide

## History database (audit trail)

The proxy writes call records to a history database. **SQLite is safe for single-replica deployments only.**

Default path: `~/.mastyf-ai/history.db` (override with `MASTYF_AI_DB_PATH`).

### Single replica (Docker Compose, local, one pod)

SQLite is the default and works well:

```bash
DB_TYPE=sqlite
# optional: MASTYF_AI_DB_PATH=/data/history.db
```

### Multi-replica options

When running **more than one proxy instance**, do **not** share one SQLite file across replicas.

| Option | When to use | Configuration |
|--------|-------------|---------------|
| **PostgreSQL** | Production HA (recommended) | `DB_TYPE=postgres` + `DATABASE_URL` (via PgBouncer in K8s) |
| **Per-instance SQLite** | Edge / dev scale-out | Unique `MASTYF_AI_DB_PATH` per pod (e.g. subPath or emptyDir) |
| **SQLite + Postgres sync** | Transitional | Keep local SQLite + `MASTYF_AI_AUDIT_SYNC_ENABLED=true` + `DATABASE_URL` |

Startup guard (implemented in `src/utils/enterprise-bootstrap.ts` → `assertSQLiteMultiReplicaSafety()`):

| Signal | Meaning |
|--------|---------|
| `MASTYF_AI_REPLICA_COUNT` or `REPLICA_COUNT` **> 1** | Operator-declared scale-out (Helm sets both from `replicaCount`; set manually for Docker Compose `scale`) |
| `DB_TYPE=sqlite` (default) | Shared SQLite history path is unsafe across replicas |

When both apply:

- **`MASTYF_AI_STRICT_MODE=true` or `MASTYF_AI_ENTERPRISE_MODE=true`** → process **exits** at bootstrap (`runEnterpriseSecurityPreflight()`).
- Otherwise → **warning** only (community multi-replica).

Helm also blocks invalid combos at render time (`templates/validate-config.yaml`): `replicaCount > 1` + `database.type=sqlite` fails `helm template`.

### Inbound TLS and proxy authentication

Production HTTP proxy ([`src/proxy/http-proxy-server.ts`](../src/proxy/http-proxy-server.ts)) supports optional **inbound** TLS and startup guards:

| Variable | Effect |
|----------|--------|
| `MASTYF_AI_TLS_CERT_PATH` + `MASTYF_AI_TLS_KEY_PATH` | Listen with `https://` on the proxy port |
| `MASTYF_AI_REQUIRE_INBOUND_TLS=true` | Fail startup if cert/key paths are unset |
| `MASTYF_AI_AUTH_REQUIRED=true` | Fail startup unless an `OAuthValidator` is passed to the proxy constructor |

Enterprise deployments may terminate TLS at ingress (nginx/Helm) **or** enable inbound TLS on the proxy directly. Upstream TLS to MCP servers is enforced separately via `assertUpstreamTlsAllowed` (see strict-mode docs).

### Kubernetes (Helm)

- Default chart: `replicaCount: 1`, `database.type: sqlite`
- HA overlay: use `values-ha.yaml` (`replicaCount: 3`, `database.type: postgres`)
- `helm template` fails if `replicaCount > 1` with `database.type: sqlite`

```bash
helm upgrade --install mastyf-ai ./deploy/helm/mastyf-ai \
  -f deploy/helm/mastyf-ai/values-ha.yaml
```

### Docker Compose scale-out

For `docker compose up --scale mastyf-ai=3`, set `MASTYF_AI_REPLICA_COUNT=3` (or `REPLICA_COUNT=3`) so the startup guard can detect scale-out:

1. Set `DB_TYPE=postgres` and provide `DATABASE_URL`, **or**
2. Give each container a unique volume/path for `MASTYF_AI_DB_PATH`, **or**
3. Enable audit sync to Postgres as above.
