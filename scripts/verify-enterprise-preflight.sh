#!/usr/bin/env sh
# Preflight checks for enterprise Helm/env — exits non-zero on hard failures.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FAIL=0
warn() { echo "[enterprise-preflight] WARN: $*" >&2; }
fail() { echo "[enterprise-preflight] FAIL: $*" >&2; FAIL=1; }
ok() { echo "[enterprise-preflight] OK: $*"; }

echo "[enterprise-preflight] MCP Mastyff AI enterprise preflight"

if [ -f dist/cli.js ]; then
  ok "dist/cli.js present"
else
  fail "run pnpm build before deploy"
fi

if [ "${DASHBOARD_AUTH_DISABLED:-}" = "true" ]; then
  fail "DASHBOARD_AUTH_DISABLED=true is not allowed for enterprise (set false or unset)"
else
  ok "dashboard auth not explicitly disabled"
fi

if [ "${MASTYFF_AI_STRICT_MODE:-}" != "true" ]; then
  warn "MASTYFF_AI_STRICT_MODE is not true — multi-replica may misbehave without Redis"
fi

if [ -n "${DATABASE_URL:-}" ]; then
  case "$DATABASE_URL" in
    *pgbouncer*|*:6432*)
      ok "DATABASE_URL appears pooler-shaped"
      ;;
    *)
      if [ "${MASTYFF_AI_REQUIRE_PGBOUNCER:-}" = "true" ]; then
        fail "MASTYFF_AI_REQUIRE_PGBOUNCER=true but DATABASE_URL is not PgBouncer"
      else
        warn "DATABASE_URL does not look like PgBouncer — required for K8s HA"
      fi
      ;;
  esac
else
  warn "DATABASE_URL unset — SQLite OK for pilot only"
fi

if [ -z "${REDIS_URL:-}" ] && [ -z "${REDIS_SENTINELS:-}" ] && [ -z "${REDIS_CLUSTER_NODES:-}" ]; then
  warn "No REDIS_URL / Sentinel / Cluster — rate limits and DPoP jti are per-pod only"
else
  ok "Redis configuration present"
fi

if [ -f deploy/helm/mastyff-ai/values-enterprise.yaml ]; then
  ok "Helm values-enterprise.yaml present"
else
  fail "missing deploy/helm/mastyff-ai/values-enterprise.yaml"
fi

if [ -f default-policy.yaml ]; then
  if grep -q 'mode: block' default-policy.yaml 2>/dev/null; then
    ok "default-policy.yaml uses block mode"
  else
    warn "default-policy.yaml mode is not block"
  fi
fi

if command -v helm >/dev/null 2>&1; then
  ok "helm available"
else
  warn "helm not in PATH — skip chart lint"
fi

if [ "$FAIL" -ne 0 ]; then
  echo "[enterprise-preflight] One or more checks failed" >&2
  exit 1
fi

echo "[enterprise-preflight] All hard checks passed (review WARN lines before production)"
