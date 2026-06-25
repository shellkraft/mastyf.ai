# Base44 Superagent — mastyf.ai Performance Analyst

Configure a Base44 Superagent to pull structured performance data from mastyf.ai and deliver a weekly digest.

## Prerequisites

- Base44 account (Builder plan+ for workspace custom integrations)
- mastyf.ai cloud deployed with `DATABASE_URL` configured
- `MASTYF_REPORTS_API_KEY` set on Vercel (generate with `openssl rand -base64 32`)

## 1. Create the Superagent

1. Open Base44 → **Superagents** → **Create**
2. Name: **mastyf Performance Analyst**
3. **Customize → Personalization → Identity** — paste from [`superagent-identity.md`](./superagent-identity.md)
4. **Customize → Security → Secrets** — add:
   - `MASTYF_REPORTS_API_KEY` — same value as Vercel env
   - `MASTYF_CLOUD_URL` — `https://mastyf-ai-cloud-jet.vercel.app`

## 2. Connect GitHub

1. **Tools → Connectors → GitHub** → Connect
2. Grant read access to `mastyf-ai/mastyf.ai`

## 3. Add custom workspace integration

1. Workspace **Settings → Integrations → New Integration**
2. Import OpenAPI from URL:
   ```
   https://mastyf-ai-cloud-jet.vercel.app/openapi.yaml
   ```
3. Select endpoints:
   - `GET /api/v1/reports/performance`
   - `GET /api/v1/observatory/snapshot`
   - `GET /api/v1/badge/{package}/json`
4. Add header: `Authorization: Bearer <MASTYF_REPORTS_API_KEY>` (stored as workspace secret)

See [`connectors-setup.md`](./connectors-setup.md) for details.

## 4. Schedule weekly task

1. Open the Superagent → **Tasks → New scheduled task**
2. Schedule: Monday 9:00 AM (your timezone)
3. Paste prompt from [`weekly-task.md`](./weekly-task.md)

## 5. Enable proxy metrics (self-hosted)

On any machine running the mastyf.ai proxy:

```bash
export MASTYF_AI_CONTROL_PLANE_URL=https://mastyf-ai-cloud-jet.vercel.app
export MASTYF_AI_CLOUD_API_KEY=gcp_your_org_api_key
export MASTYF_AI_INSTANCE_NAME=dev-proxy
pnpm dashboard:proxy
# or: node dist/cli.js start
```

Heartbeats include `totalRequests`, `blockedRequests`, `totalCostUsd`, and `topBlockRules` from local `history.db`.

See [`proxy-heartbeat.md`](./proxy-heartbeat.md).

## API reference

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/v1/reports/performance?window=7d` | Bearer | Full structured report |
| `GET /api/v1/observatory/snapshot` | Public | Ecosystem snapshot |
| `GET /api/v1/badge/{pkg}/json` | Public | Single package score |

OpenAPI: https://mastyf-ai-cloud-jet.vercel.app/openapi.yaml

## Output schema

Superagent weekly files should match [`performance-report-schema.json`](./performance-report-schema.json).
