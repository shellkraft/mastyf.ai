# SaaS Control Plane

Cloud org/tenant model for `apps/cloud` (Vercel).

## Org = tenant

- Organization `slug` maps to self-hosted `X-Mastyf-Ai-Tenant` header
- Policy YAML stored per org in Postgres `policies` table
- API keys scoped to org with optional `scopes[]`

## Roles

| Role | Permissions |
|------|-------------|
| `viewer` | Read policy, badges, certifications |
| `operator` | Policy test, deep-scan triggers |
| `admin` | Policy PUT, API key rotation |
| `owner` | Org delete, billing, member invite |

Route guards mirror self-hosted `dashboard-rbac.ts` via `apps/cloud/lib/org-rbac.ts`.

## Audit on cloud

Cloud trust API does not persist call records. Audit = Postgres org tables + Vercel request logs + policy version history.

Policy sync: `GET/PUT /api/v1/policy` validates YAML against shared Zod schema before write.

## Deployment

- PR → Vercel preview (`cloud-deploy-staging.yml`)
- `main` merge → production with GitHub Environment approval (`cloud-deploy.yml`)

See [apps/cloud/docs/VERCEL_DEPLOY.md](../apps/cloud/docs/VERCEL_DEPLOY.md).
