#!/usr/bin/env sh
# Automated checks from docs/MULTI_TENANCY.md production pilot checklist.
# Run against a staging dashboard/proxy after enabling multi-tenant mode.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FAIL=0
warn() { echo "[pilot] WARN: $*" >&2; }
fail() { echo "[pilot] FAIL: $*" >&2; FAIL=1; }
ok() { echo "[pilot] OK: $*"; }

DASHBOARD_PORT="${DASHBOARD_PORT:-41399}"
BASE_URL="${PILOT_BASE_URL:-http://127.0.0.1:${DASHBOARD_PORT}}"

echo "[pilot] Multi-tenant staging pilot verification"
echo "[pilot] Base URL: $BASE_URL"

if [ "${MASTYFF_AI_MULTI_TENANT_ENABLED:-}" != "true" ]; then
  warn "MASTYFF_AI_MULTI_TENANT_ENABLED is not true — set for production pilot"
fi

# Step 6: automated dashboard regression
if pnpm exec vitest run tests/dashboard/dashboard-multi-tenant.test.ts; then
  ok "dashboard multi-tenant vitest regression"
else
  fail "dashboard multi-tenant vitest regression"
fi

# Step 3: tenant-scoped audit API (requires running dashboard on PILOT_BASE_URL)
if curl -sf "${BASE_URL}/api/aggregate/audit" -H 'X-Mastyff-Ai-Tenant: tenant-a' >/tmp/pilot-a.json 2>/dev/null; then
  if grep -q 'only-b' /tmp/pilot-a.json 2>/dev/null; then
    fail "tenant-a audit leaked tenant-b rows"
  else
    ok "tenant-a audit isolation (live dashboard)"
  fi
else
  warn "live dashboard not reachable at ${BASE_URL} — skip HTTP isolation checks (start dashboard for full pilot)"
fi

# Step 1/2: JWT tenant binding (unit-level)
if pnpm exec vitest run tests/tenant/multi-tenancy.test.ts; then
  ok "JWT tenant binding unit tests"
else
  fail "JWT tenant binding unit tests"
fi

env -u DASHBOARD_AUTH_DISABLED pnpm enterprise:preflight || fail "enterprise preflight"

if [ "$FAIL" -ne 0 ]; then
  echo "[pilot] One or more checks failed" >&2
  exit 1
fi

echo "[pilot] Automated pilot checks passed (complete manual JWT login + swarm steps in docs/MULTI_TENANCY.md)"
