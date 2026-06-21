# Publish mastyf.ai at www.mastyf.ai

The public site (`apps/cloud`) deploys to **Vercel** project `mastyf-ai-cloud`. Production URL: **https://www.mastyf.ai**.

## Quick publish (one command)

After DNS is configured (see below):

```bash
export VERCEL_TOKEN="..."          # https://vercel.com/account/tokens
export DATABASE_URL="postgresql://..."  # Neon Postgres

./scripts/vercel-cloud-production.sh
```

Verify:

```bash
APP_URL=https://www.mastyf.ai pnpm cloud:verify-prod
```

## Step 1 — Register / own the domain

Purchase **mastyf.ai** at a registrar (Cloudflare Registrar, Namecheap, Google Domains, etc.) if you do not already own it.

## Step 2 — Attach domain in Vercel

```bash
VERCEL_TOKEN=... ./scripts/vercel-domain-setup.sh
```

Or manually in [Vercel → mastyf-ai-cloud → Settings → Domains](https://vercel.com):

| Domain | Action |
|--------|--------|
| `www.mastyf.ai` | Add to project |
| `mastyf.ai` | Add to project, **redirect to www** |

## Step 3 — DNS records

At your DNS provider (Cloudflare recommended):

| Host | Type | Value |
|------|------|-------|
| `www` | CNAME | `cname.vercel-dns.com` |
| `@` (apex) | A | `76.76.21.21` |

If using Cloudflare, set proxy status to **DNS only** (grey cloud) until Vercel validates the domain, then you may enable the orange cloud.

Propagation usually takes 5–30 minutes. Check status in the Vercel Domains panel.

## Step 4 — Production environment variables

Set in Vercel (the deploy script does this automatically):

| Variable | Value |
|----------|-------|
| `AUTH_URL` | `https://www.mastyf.ai` |
| `NEXT_PUBLIC_APP_URL` | `https://www.mastyf.ai` |
| `NEXT_PUBLIC_CLOUD_URL` | `https://www.mastyf.ai` |
| `MASTYF_AI_CLOUD_PUBLIC_URL` | `https://www.mastyf.ai` |
| `DATABASE_URL` | Neon connection string |
| `AUTH_SECRET` | Random 32+ bytes (openssl rand -base64 32) |
| `LICENSE_JWT_SECRET` | Same as AUTH_SECRET |

Do **not** set `AUTH_DEV_LOGIN=true` in production.

## Step 5 — OAuth callbacks

Register these redirect URLs in GitHub / Google OAuth apps:

- `https://www.mastyf.ai/api/auth/callback/github`
- `https://www.mastyf.ai/api/auth/callback/google`

See `apps/cloud/docs/OAUTH_CLOUD_SETUP.md` for details.

## Step 6 — Webhooks & billing

- **Lemon Squeezy**: webhook URL `https://www.mastyf.ai/api/webhooks/lemonsqueezy`
- Run DB migrations: `DATABASE_URL=... pnpm cloud:migrate:prod`

## Step 7 — Self-hosted MCP Guardian proxies

Point local installs at the new control plane:

```bash
export MASTYF_AI_CONTROL_PLANE_URL=https://www.mastyf.ai
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Domain shows “Invalid configuration” in Vercel | Wait for DNS; confirm CNAME/A records |
| OAuth redirect mismatch | Update callback URLs to use `www.mastyf.ai` |
| Badge links point to vercel.app | Redeploy after setting `NEXT_PUBLIC_APP_URL` |
| 500 on login | Run migrations; check `DATABASE_URL` |

Legacy URL `https://mastyf-ai-cloud.vercel.app` continues to work as a Vercel alias until removed.
