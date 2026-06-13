#!/usr/bin/env sh
# Production cutover verification — docs/ENTERPRISE_DEPLOY.md P0 checklist.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FAIL=0
warn() { echo "[cutover] WARN: $*" >&2; }
fail() { echo "[cutover] FAIL: $*" >&2; FAIL=1; }
ok() { echo "[cutover] OK: $*"; }

echo "[cutover] MCP Mastyff AI production cutover verification"

# Build + tests
pnpm run build || fail "pnpm build"
pnpm test || fail "pnpm test"
pnpm test:integration || fail "pnpm test:integration"
MASTYFF_AI_DISABLE_SEMANTIC=true pnpm verify:corpus || fail "corpus verify"

# Enterprise preflight (expects production-like env when set)
env -u DASHBOARD_AUTH_DISABLED pnpm enterprise:preflight || fail "enterprise preflight"

# Policy block mode
if grep -q 'mode: block' default-policy.yaml 2>/dev/null; then
  ok "default-policy.yaml block mode"
else
  warn "default-policy.yaml is not block mode — use audit→warn→block rollout"
fi

# Helm enterprise overlay
if [ -f deploy/helm/mastyff-ai/values-enterprise.yaml ]; then
  ok "values-enterprise.yaml present"
  if command -v helm >/dev/null 2>&1; then
    helm dependency update deploy/helm/mastyff-ai >/dev/null 2>&1 || true
    helm template mastyff-ai deploy/helm/mastyff-ai \
      -f deploy/helm/mastyff-ai/values.yaml \
      -f deploy/helm/mastyff-ai/values-enterprise.yaml \
      --set redis.enabled=false \
      > /dev/null && ok "helm template enterprise overlay"
  fi
else
  fail "missing values-enterprise.yaml"
fi

# Postgres migrations present
for m in 004-tenant-scoping.sql 005-tenant-cost-security-health.sql; do
  if [ -f "src/database/migrations/$m" ]; then
    ok "migration $m present"
  else
    fail "missing migration $m"
  fi
done

# Evidence pack generator
if pnpm enterprise:compliance-report >/dev/null 2>&1; then
  ok "compliance report generator"
else
  warn "compliance report generator failed or needs env"
fi

if [ "$FAIL" -ne 0 ]; then
  echo "[cutover] One or more checks failed" >&2
  exit 1
fi

echo "[cutover] Automated cutover checks passed — apply migrations 004/005 on Postgres before traffic cutover"
