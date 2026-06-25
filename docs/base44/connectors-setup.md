# Base44 connectors setup

## GitHub connector

1. Superagent → **Tools → Connectors**
2. Connect **GitHub**
3. Verify access to `mastyf-ai/mastyf.ai`

The weekly task uses GitHub for `product.githubStars`, `product.githubForks`, `product.openIssues`.

## Custom workspace integration (mastyf.ai API)

Requires **Builder plan+** and workspace admin.

### Import OpenAPI

1. Workspace **Settings → Integrations → New Integration**
2. **From URL:**
   ```
   https://mastyf-ai-cloud-jet.vercel.app/openapi.yaml
   ```
3. **Slug:** `mastyf-ai`
4. **Name:** mastyf.ai Cloud

### Select operations (max 30)

| Method | Path | Use |
|--------|------|-----|
| GET | `/api/v1/reports/performance` | Weekly aggregate report |
| GET | `/api/v1/observatory/snapshot` | Ecosystem health |
| GET | `/api/v1/badge/{package}/json` | Spot-check package scores |

### Authentication header

Add custom header on the integration:

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer {{MASTYF_REPORTS_API_KEY}}` |

Store `MASTYF_REPORTS_API_KEY` as a workspace secret (same value as Vercel env).

### Link to Superagent

1. Superagent → **Tools**
2. Enable the **mastyf-ai** workspace integration
3. Test in chat: "Call getPerformanceReport with window 7d"

## Optional channels

- **Slack** — deliver weekly 5-bullet summary to a channel
- **Gmail** — email report JSON as attachment
- **WhatsApp/Telegram** — mobile briefing

## Product Hunt upvotes

No public API in v1. Either:

- Update Superagent **saved fact** `productHuntUpvotes` manually each week, or
- Paste count into the weekly task chat when it runs
