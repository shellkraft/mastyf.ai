# Proxy heartbeat for performance reports

The cloud performance API `proxy` section reads from `mastyf_ai_fleet_instances.metrics_snapshot`. Populate it by running a self-hosted mastyf.ai proxy with cloud heartbeat enabled.

## Environment variables

```bash
export MASTYF_AI_CONTROL_PLANE_URL=https://mastyf-ai-cloud-jet.vercel.app
export MASTYF_AI_CLOUD_API_KEY=gcp_your_org_api_key_from_cloud_dashboard
export MASTYF_AI_INSTANCE_ID=mastyf-dev-1
export MASTYF_AI_INSTANCE_NAME=local-dev-proxy
export MASTYF_AI_HEARTBEAT_INTERVAL_MS=60000
export MASTYF_AI_HEARTBEAT_METRICS_DAYS=7
```

Create an org API key from the mastyf.ai cloud console after sign-in.

## Start the proxy

From repo root:

```bash
pnpm build
export MASTYF_AI_CONTROL_PLANE_URL=https://mastyf-ai-cloud-jet.vercel.app
export MASTYF_AI_CLOUD_API_KEY=gcp_...
node dist/cli.js start
```

Or:

```bash
pnpm dashboard:proxy
```

On startup you should see:

```
[instance-registry] Cloud heartbeat started (interval=60000ms)
```

## Metrics included in each heartbeat

From local `history.db` (last 7 days by default):

| Field | Description |
|-------|-------------|
| `totalRequests` | Tool calls recorded |
| `blockedRequests` | Policy blocks |
| `totalCostUsd` | Sum of `cost_usd` on call records |
| `topBlockRules` | Top block rules by count |

Implementation: [`src/utils/heartbeat-proxy-metrics.ts`](../../src/utils/heartbeat-proxy-metrics.ts)

## Verify

1. Wait 1–2 minutes after proxy start
2. Call performance API:
   ```bash
   curl -s -H "Authorization: Bearer $MASTYF_REPORTS_API_KEY" \
     "https://mastyf-ai-cloud-jet.vercel.app/api/v1/reports/performance?window=7d" \
     | jq '.proxy'
   ```
3. Expect `activeInstances >= 1` and non-zero metrics after traffic flows through the proxy

## Generate traffic for testing

Use Cursor/Cline with MCP routed through the proxy, or run policy test calls against connected MCP servers.
