#!/usr/bin/env bash
# Smoke-test MCP Mastyf AI Cloud production (no purchase required).
# Full Pro E2E still needs a Lemon Squeezy test checkout + webhook secret.
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

echo "MCP Mastyf AI Cloud production smoke — $APP_URL"
echo ""

check "Landing" "$APP_URL/" "200"
check "Terms" "$APP_URL/terms" "200"
check "Privacy" "$APP_URL/privacy" "200"
check "Login" "$APP_URL/login" "200"
check "Fleet dashboard (auth redirect ok)" "$APP_URL/dashboard/fleet" "307"
check "License API without key" "$APP_URL/api/v1/license" "401"
check "Heartbeat without key" "$APP_URL/api/v1/instances/heartbeat" "401" POST

echo ""
echo "Webhook endpoint (unsigned POST should reject):"
WH_CODE="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$APP_URL/api/webhooks/lemonsqueezy" \
  -H 'Content-Type: application/json' -d '{}' || echo "000")"
if [[ "$WH_CODE" == "401" || "$WH_CODE" == "403" || "$WH_CODE" == "400" ]]; then
  echo "OK   Webhook rejects unsigned body ($WH_CODE)"
else
  echo "WARN Webhook returned $WH_CODE (expected 401/403/400)"
fi

echo ""
echo "Manual Pro E2E (requires LS test mode):"
echo "  1. Complete test checkout at NEXT_PUBLIC_PRO_CHECKOUT_URL"
echo "  2. Confirm row in pro_license_keys (Neon)"
echo "  3. curl -H 'Authorization: Bearer YOUR-KEY' $APP_URL/api/v1/license"
echo "  See docs/WEBHOOK_AUTOMATION.md"

exit "$FAIL"
