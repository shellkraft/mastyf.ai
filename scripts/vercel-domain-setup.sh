#!/usr/bin/env bash
# Attach www.mastyf.ai (and apex mastyf.ai) to the mastyf-ai-cloud Vercel project.
#
# Prerequisites:
#   1. Own the mastyf.ai domain at your registrar (Cloudflare, Namecheap, etc.)
#   2. VERCEL_TOKEN from https://vercel.com/account/tokens
#
# Usage:
#   VERCEL_TOKEN=... ./scripts/vercel-domain-setup.sh
#
# After running, add the DNS records Vercel prints (or see apps/cloud/docs/CUSTOM_DOMAIN.md).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCOPE="${VERCEL_SCOPE:-mastyf-ai-gmailcoms-projects}"
PROJECT="${VERCEL_PROJECT:-mastyf-ai-cloud}"
WWW_DOMAIN="${WWW_DOMAIN:-www.mastyf.ai}"
APEX_DOMAIN="${APEX_DOMAIN:-mastyf.ai}"
VERCEL_CLI="${VERCEL_CLI:-npx vercel@48}"

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "ERROR: Set VERCEL_TOKEN (https://vercel.com/account/tokens)"
  exit 1
fi

echo "Vercel account:"
$VERCEL_CLI whoami --token "$VERCEL_TOKEN"

echo ""
echo "Adding $WWW_DOMAIN to project $PROJECT ..."
$VERCEL_CLI domains add "$WWW_DOMAIN" "$PROJECT" \
  --token "$VERCEL_TOKEN" \
  --scope "$SCOPE" \
  || echo "(domain may already be linked — continuing)"

echo ""
echo "Adding apex $APEX_DOMAIN (redirect to $WWW_DOMAIN) ..."
$VERCEL_CLI domains add "$APEX_DOMAIN" "$PROJECT" \
  --token "$VERCEL_TOKEN" \
  --scope "$SCOPE" \
  || echo "(apex may already be linked — configure redirect in Vercel dashboard if needed)"

echo ""
echo "Domain status:"
$VERCEL_CLI domains inspect "$WWW_DOMAIN" --token "$VERCEL_TOKEN" --scope "$SCOPE" 2>/dev/null \
  || $VERCEL_CLI domains ls --token "$VERCEL_TOKEN" --scope "$SCOPE"

echo ""
echo "=== DNS records (add at your registrar) ==="
echo ""
echo "  $WWW_DOMAIN"
echo "    Type: CNAME"
echo "    Name: www"
echo "    Value: cname.vercel-dns.com"
echo ""
echo "  $APEX_DOMAIN (apex / naked domain)"
echo "    Type: A"
echo "    Name: @"
echo "    Value: 76.76.21.21"
echo ""
echo "    — or use ALIAS/ANAME to cname.vercel-dns.com if your registrar supports it"
echo ""
echo "In Vercel → Project → Settings → Domains:"
echo "  • Set $APEX_DOMAIN to redirect to $WWW_DOMAIN"
echo ""
echo "After DNS propagates (usually 5–30 min), deploy with:"
echo "  APP_URL=https://$WWW_DOMAIN VERCEL_TOKEN=... DATABASE_URL=... $ROOT/scripts/vercel-cloud-production.sh"
