# Pro purchase — email / product description template

Paste into **Lemon Squeezy → Product → Description** and/or customize the **receipt email** (LS sends the license key automatically).

**Production control plane URL:** `https://mcp-guardian-cloud.vercel.app`

---

**Subject:** Your MCP Guardian Pro license

Thank you for purchasing **MCP Guardian Pro — Lifetime** ($4.99 one-time).

**Your license key:** `{license_key}`  
(Lemon Squeezy inserts the key automatically — do not edit the `{license_key}` placeholder if LS provides it.)

**Control plane URL (same for all buyers):** `https://mcp-guardian-cloud.vercel.app`

## Quick start

1. **Install** (self-hosted):
   ```bash
   npm install -g @mcp-guardian/server
   ```

2. **Set your license** in the environment where you run the proxy or dashboard:
   ```bash
   export GUARDIAN_LICENSE_KEY=<paste-your-key-here>
   export GUARDIAN_CONTROL_PLANE_URL=https://mcp-guardian-cloud.vercel.app
   ```

3. **Run the proxy** (example):
   ```bash
   mcp-guardian proxy --config mcp.json --policy default-policy.yaml
   ```

Full guide: https://github.com/rudraneel93/mcp-guardian/blob/master/docs/PRO_SETUP.md

**v3.0+:** Security Swarm CLI (`pnpm security-swarm:analyze`) requires this license. License terms: https://github.com/rudraneel93/mcp-guardian/blob/master/docs/PRO_LICENSE.md

## What Pro includes

- Lifetime Pro license (no subscription)
- Self-hosted MCP Guardian — runtime security, cost governance, and health monitoring for MCP tool calls
- Email support via your purchase receipt

The core project remains open source (MIT). Your payment supports ongoing development and registers your Pro license.

## Need help?

Reply to this email or open a discussion on GitHub: https://github.com/rudraneel93/mcp-guardian/discussions

---

**Seller note:** Update the control plane URL if you deploy `apps/cloud` to a custom domain.
