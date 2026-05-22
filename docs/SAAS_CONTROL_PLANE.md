# MCP Guardian Cloud (optional control plane)

Free, open-source hosted control plane for MCP Guardian: OAuth signup, tenant provisioning, policy management, and API keys for connecting self-hosted Guardian instances. No billing or subscription required.

## What it is

- **Cloud app** (`apps/cloud`): Next.js 15 + Auth.js (Google/GitHub) + Postgres
- **Not included**: managed Guardian proxy hosting (customers run Guardian themselves)

See [ENTERPRISE_DEPLOY.md](./ENTERPRISE_DEPLOY.md) for self-hosted Guardian deployment.

## Quick start (local)

### 1. Infrastructure

```bash
docker compose -f deploy/docker-compose.staging.yml up -d
```

Create the control-plane database:

```bash
docker exec -it deploy-postgres-1 psql -U guardian -c "CREATE DATABASE mcp_guardian_cloud;"
```

(Container name may vary; use `docker ps` to confirm.)

### 2. Configure secrets

```bash
cp apps/cloud/.env.example apps/cloud/.env.local
# Fill AUTH_*, DATABASE_URL, OAuth client IDs
```

**Google OAuth**

- Console → APIs & Services → Credentials → OAuth client (Web)
- Redirect URI: `http://localhost:3001/api/auth/callback/google`

**GitHub OAuth**

- Settings → Developer settings → OAuth App
- Callback URL: `http://localhost:3001/api/auth/callback/github`

### 3. Migrate and run

```bash
pnpm install
DATABASE_URL=postgresql://guardian:guardian@127.0.0.1:5432/mcp_guardian_cloud \
  pnpm --filter @mcp-guardian/cloud run db:migrate

pnpm cloud:dev
```

Open http://localhost:3001 — sign in to auto-provision an organization (no payment step).

### 4. Connect self-hosted Guardian (optional)

After sign-in:

1. **Settings → Rotate API key** — copy the `gcp_...` key (shown once) if you want policy sync via API
2. Set on your Guardian host (all features available without a license):

```bash
GUARDIAN_MULTI_TENANT_ENABLED=true
GUARDIAN_TENANT_ID=<your-org-slug>
GUARDIAN_CONTROL_PLANE_URL=https://cloud.example.com
DASHBOARD_JWT_SECRET=<secret>
GUARDIAN_CLOUD_JWT_SECRET=<same-as-cloud-LICENSE_JWT_SECRET>
```

3. Deploy policy YAML to `policy-templates/tenants/<slug>/policy.yaml`
4. Cloud dashboard → **Open live dashboard** (SSO exchange into WebSocket ops dashboard)

Guardian is fully open source by default. License enforcement is **opt-in** only via `GUARDIAN_REQUIRE_LICENSE=true` (not used by the cloud control plane).

**Automation**

```bash
CONTROL_PLANE_URL=http://localhost:3001 \
CONTROL_PLANE_API_KEY=gcp_... \
node scripts/export-tenant-bundle.mjs --out ./tenant-bundle
```

## API (machine auth)

Bearer token: `Authorization: Bearer gcp_...`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/org` | Organization metadata |
| GET | `/api/v1/policy` | Policy YAML (`text/yaml`) |
| PUT | `/api/v1/policy` | Update policy (JSON `{ "yaml": "..." }` or raw YAML) |
| POST | `/api/v1/keys/rotate` | Rotate API key (returns new key once) |
| POST | `/api/v1/license/exchange` | Exchange one-time launch token for session JWT (SSO) |
| POST | `/api/dashboard/launch` | Cloud UI: create launch redirect URL |

Session-authenticated browser users can also manage policy and keys via the dashboard UI.

## Architecture

```mermaid
flowchart LR
  User --> CloudApp["apps/cloud"]
  CloudApp --> OAuth["Google / GitHub"]
  CloudApp --> PG[("mcp_guardian_cloud")]
  User --> Guardian["Self-hosted Guardian"]
  Guardian --> PolicyFile["policy-templates/tenants/slug"]
  CloudApp --> PolicyAPI["/api/v1/policy"]
  PolicyAPI --> Guardian
```

## Docker Compose (cloud service)

With `deploy/docker-compose.staging.yml`:

```bash
docker compose -f deploy/docker-compose.staging.yml --profile cloud up -d
```

Set `apps/cloud/.env.local` before building the cloud image, or mount env at runtime.

## Security notes

- API keys are bcrypt-hashed; plaintext shown only on create/rotate
- Control-plane Postgres is **separate** from Guardian audit DB

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Redirect loop after login | Ensure `AUTH_URL` matches browser origin |
| No org after login | Check `DATABASE_URL`; layout auto-provisions on first dashboard visit |
| 401 on `/api/v1/*` | Rotate key in Settings |
| WebSocket closes 4401 | Log in to dashboard first, or use cloud **Open live dashboard** SSO |
| Policy not applied on Guardian | Copy YAML to `policy-templates/tenants/<slug>/policy.yaml` and restart or reload |
