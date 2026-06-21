#!/usr/bin/env bash
# Configure mastyf-ai-cloud on Vercel and trigger production redeploy.
# Requires: VERCEL_TOKEN from https://vercel.com/account/tokens (mastyf-ai-gmailcom account)
# Optional: DATABASE_URL, AUTH_SECRET (generated if unset)
#
# Production URL defaults to https://www.mastyf.ai — override with APP_URL if needed.
# Run ./scripts/vercel-domain-setup.sh first to attach the custom domain.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLOUD="$ROOT/apps/cloud"
SCOPE="${VERCEL_SCOPE:-mastyf-ai-gmailcoms-projects}"
PROJECT="${VERCEL_PROJECT:-mastyf-ai-cloud}"
APP_URL="${APP_URL:-https://www.mastyf.ai}"
VERCEL_CLI="${VERCEL_CLI:-npx vercel@48}"

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "ERROR: Set VERCEL_TOKEN (create at https://vercel.com/account/tokens while logged in as mastyf-ai-gmailcom)"
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
add_env NEXT_PUBLIC_CLOUD_URL "$APP_URL"
add_env MASTYF_AI_CLOUD_PUBLIC_URL "$APP_URL"

if [[ -n "${AUTH_GITHUB_ID:-}" && -n "${AUTH_GITHUB_SECRET:-}" ]]; then
  add_env AUTH_GITHUB_ID "$AUTH_GITHUB_ID"
  add_env AUTH_GITHUB_SECRET "$AUTH_GITHUB_SECRET"
fi

if [[ -n "${AUTH_GOOGLE_ID:-}" && -n "${AUTH_GOOGLE_SECRET:-}" ]]; then
  add_env AUTH_GOOGLE_ID "$AUTH_GOOGLE_ID"
  add_env AUTH_GOOGLE_SECRET "$AUTH_GOOGLE_SECRET"
fi

echo "Deploying production from monorepo root (Vercel Root Directory = apps/cloud)..."
cd "$ROOT"
rm -rf .vercel
$VERCEL_CLI link --yes --token "$VERCEL_TOKEN" --scope "$SCOPE" --project "$PROJECT"
$VERCEL_CLI deploy --prod --yes --token "$VERCEL_TOKEN" --scope "$SCOPE"

echo ""
echo "Done. Production URL: $APP_URL"
echo "Vercel preview: https://mastyf-ai-cloud.vercel.app (still works as alias)"
echo "AUTH_SECRET (save for cloud API key hashing): $AUTH_SECRET"
echo "License test: curl -H 'Authorization: Bearer YOUR-CLOUD-API-KEY' ${APP_URL}/api/v1/license"
echo ""
echo "Verify: APP_URL=$APP_URL pnpm cloud:verify-prod"
