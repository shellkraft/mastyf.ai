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

Startup guard: with `MASTYF_AI_STRICT_MODE=true` or `MASTYF_AI_ENTERPRISE_MODE=true`, the proxy **refuses to start** if multiple replicas are detected and `DB_TYPE=sqlite`.

### Kubernetes (Helm)

- Default chart: `replicaCount: 1`, `database.type: sqlite`
- HA overlay: use `values-ha.yaml` (`replicaCount: 3`, `database.type: postgres`)
- `helm template` fails if `replicaCount > 1` with `database.type: sqlite`

```bash
helm upgrade --install mastyf-ai ./deploy/helm/mastyf-ai \
  -f deploy/helm/mastyf-ai/values-ha.yaml
```

### Docker Compose scale-out

For `docker compose up --scale mastyf-ai=3`:

1. Set `DB_TYPE=postgres` and provide `DATABASE_URL`, **or**
2. Give each container a unique volume/path for `MASTYF_AI_DB_PATH`, **or**
3. Enable audit sync to Postgres as above.
