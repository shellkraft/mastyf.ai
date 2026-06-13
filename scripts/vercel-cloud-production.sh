#!/usr/bin/env bash
# Configure mastyff-ai-cloud on Vercel and trigger production redeploy.
# Requires: VERCEL_TOKEN from https://vercel.com/account/tokens (mastyff-ai-gmailcom account)
# Optional: DATABASE_URL, LEMONSQUEEZY_WEBHOOK_SECRET, AUTH_SECRET (generated if unset)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLOUD="$ROOT/apps/cloud"
SCOPE="mastyff-ai-gmailcoms-projects"
PROJECT="mastyff-ai-cloud"
APP_URL="https://mastyff-ai-cloud.vercel.app"
CHECKOUT_URL="https://mastyff-ai.lemonsqueezy.com/checkout/buy/f725abfe-93c0-4bd7-8add-d15af13958fb"
VERCEL_CLI="${VERCEL_CLI:-npx vercel@48}"

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "ERROR: Set VERCEL_TOKEN (create at https://vercel.com/account/tokens while logged in as mastyff-ai-gmailcom)"
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: Set DATABASE_URL (Neon connection string)"
  exit 1
fi

AUTH_SECRET="${AUTH_SECRET:-$(openssl rand -base64 32)}"
LICENSE_JWT_SECRET="${LICENSE_JWT_SECRET:-$AUTH_SECRET}"

echo "Vercel account:"
$VERCEL_CLI whoami --token "$VERCEL_TOKEN"

echo "Linking $SCOPE / $PROJECT ..."
cd "$CLOUD"
rm -rf .vercel
$VERCEL_CLI link --yes --token "$VERCEL_TOKEN" --scope "$SCOPE" --project "$PROJECT"

add_env() {
  local name="$1"
  local value="$2"
  echo "  + $name"
  printf '%s' "$value" | $VERCEL_CLI env add "$name" production --force --token "$VERCEL_TOKEN" --scope "$SCOPE" >/dev/null 2>&1 \
    || printf '%s' "$value" | $VERCEL_CLI env add "$name" production --token "$VERCEL_TOKEN" --scope "$SCOPE"
}

echo "Setting production environment variables..."
add_env DATABASE_URL "$DATABASE_URL"
add_env AUTH_SECRET "$AUTH_SECRET"
add_env LICENSE_JWT_SECRET "$LICENSE_JWT_SECRET"
add_env AUTH_URL "$APP_URL"
add_env NEXT_PUBLIC_APP_URL "$APP_URL"
add_env NEXT_PUBLIC_PRO_CHECKOUT_URL "$CHECKOUT_URL"

if [[ -n "${LEMONSQUEEZY_WEBHOOK_SECRET:-}" ]]; then
  add_env LEMONSQUEEZY_WEBHOOK_SECRET "$LEMONSQUEEZY_WEBHOOK_SECRET"
else
  echo "  (skip LEMONSQUEEZY_WEBHOOK_SECRET — set later in LS dashboard)"
fi

if [[ -n "${LEMONSQUEEZY_STORE_ID:-}" ]]; then
  add_env LEMONSQUEEZY_STORE_ID "$LEMONSQUEEZY_STORE_ID"
fi

echo "Deploying production from monorepo root (Vercel Root Directory = apps/cloud)..."
cd "$ROOT"
rm -rf .vercel
$VERCEL_CLI link --yes --token "$VERCEL_TOKEN" --scope "$SCOPE" --project "$PROJECT"
$VERCEL_CLI deploy --prod --yes --token "$VERCEL_TOKEN" --scope "$SCOPE"

echo ""
echo "Done. Production URL: $APP_URL"
echo "AUTH_SECRET (save for license hashing + local register-pro-key): $AUTH_SECRET"
echo "Lemon Squeezy webhook: ${APP_URL}/api/webhooks/lemonsqueezy"
echo "License test: curl -H 'Authorization: Bearer YOUR-KEY' ${APP_URL}/api/v1/license"
