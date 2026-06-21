#!/usr/bin/env bash
# Smoke-test mastyf.ai Cloud production.
set -euo pipefail

APP_URL="${APP_URL:-https://www.mastyf.ai}"
FAIL=0

check() {
  local name="$1"
  local url="$2"
  local expect="$3"
  local method="${4:-GET}"
  local code
  if [[ "$method" == "POST" ]]; then
    code="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$url" \
      -H 'Content-Type: application/json' -d '{}' || echo "000")"
  else
    code="$(curl -sS -o /dev/null -w '%{http_code}' "$url" || echo "000")"
  fi
  if [[ "$code" == "$expect" ]]; then
    echo "OK   $name ($code) $url"
  else
    echo "FAIL $name (got $code, want $expect) $url"
    FAIL=1
  fi
}

echo "mastyf.ai Cloud production smoke — $APP_URL"
echo ""

check "Landing" "$APP_URL/" "200"
check "Terms" "$APP_URL/terms" "200"
check "Privacy" "$APP_URL/privacy" "200"
check "Login" "$APP_URL/login" "200"
check "Fleet dashboard (auth redirect ok)" "$APP_URL/dashboard/fleet" "307"
check "License API without key" "$APP_URL/api/v1/license" "401"
check "Heartbeat without key" "$APP_URL/api/v1/instances/heartbeat" "401" POST

echo ""
echo "Org API key test (after sign-in): curl -H 'Authorization: Bearer YOUR-CLOUD-API-KEY' $APP_URL/api/v1/license"

exit "$FAIL"
