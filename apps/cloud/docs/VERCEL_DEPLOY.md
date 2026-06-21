# Deploy to Vercel (quick)

Production URL (for now): **https://mastyf-ai-cloud.vercel.app**

## One-time setup

1. **Vercel token** — [vercel.com/account/tokens](https://vercel.com/account/tokens) → create token for team `mastyf-ai-gmailcoms-projects`.

2. **Neon Postgres** (required for login, scores, dashboard):
   - Create a free database at [neon.tech](https://neon.tech)
   - Copy the connection string (`postgresql://...`)

3. **Run migrations**:
   ```bash
   DATABASE_URL="postgresql://..." pnpm cloud:migrate:prod
   ```

## Deploy

```bash
export VERCEL_TOKEN="..."
export DATABASE_URL="postgresql://..."   # Neon — not localhost

pnpm cloud:deploy-now
```

This builds locally, syncs env vars to project `mastyf-ai-cloud`, and deploys to production.

**Code-only redeploy** (keep existing Vercel env):

```bash
VERCEL_TOKEN=... SKIP_ENV=1 pnpm cloud:deploy-now
```

## Verify

```bash
APP_URL=https://mastyf-ai-cloud.vercel.app pnpm cloud:verify-prod
```

## Production env vars (set automatically by deploy script)

| Variable | Example |
|----------|---------|
| `AUTH_URL` | `https://mastyf-ai-cloud.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | same |
| `DATABASE_URL` | Neon connection string |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `LICENSE_JWT_SECRET` | same as `AUTH_SECRET` |

Do **not** set `AUTH_DEV_LOGIN=true` in production.

## Alternative: Vercel CLI login

```bash
npx vercel login
DATABASE_URL="postgresql://..." pnpm cloud:deploy-now
```

## Custom domain later

See [CUSTOM_DOMAIN.md](./CUSTOM_DOMAIN.md) for `www.mastyf.ai`.
