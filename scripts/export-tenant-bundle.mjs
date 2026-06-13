#!/usr/bin/env node
/**
 * Pull org policy + env snippet from MCP Mastyff AI Cloud control plane.
 *
 * Usage:
 *   CONTROL_PLANE_URL=https://cloud.example.com \
 *   CONTROL_PLANE_API_KEY=gcp_... \
 *   node scripts/export-tenant-bundle.mjs [--out ./tenant-bundle]
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const baseUrl = (process.env.CONTROL_PLANE_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const apiKey = process.env.CONTROL_PLANE_API_KEY;

if (!apiKey) {
  console.error('CONTROL_PLANE_API_KEY is required (gcp_... from cloud dashboard Settings)');
  process.exit(1);
}

const outDir = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : './tenant-bundle';

async function main() {
  const orgRes = await fetch(`${baseUrl}/api/v1/org`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!orgRes.ok) {
    throw new Error(`org fetch failed: ${orgRes.status} ${await orgRes.text()}`);
  }
  const org = await orgRes.json();

  const policyRes = await fetch(`${baseUrl}/api/v1/policy`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!policyRes.ok) {
    throw new Error(`policy fetch failed: ${policyRes.status} ${await policyRes.text()}`);
  }
  const policyYaml = await policyRes.text();

  mkdirSync(outDir, { recursive: true });
  const policyPath = join(outDir, 'policy.yaml');
  const envPath = join(outDir, 'mastyff-ai.env');
  const tenantDir = join(outDir, 'policy-templates', 'tenants', org.slug);

  mkdirSync(tenantDir, { recursive: true });
  writeFileSync(join(tenantDir, 'policy.yaml'), policyYaml);
  writeFileSync(policyPath, policyYaml);

  const envBlock = `# Generated from MCP Mastyff AI Cloud (free OSS — no subscription required)
MASTYFF_AI_MULTI_TENANT_ENABLED=true
MASTYFF_AI_TENANT_ID=${org.slug}
MASTYFF_AI_CONTROL_PLANE_URL=${baseUrl}
# Optional: sync policy via API
# MASTYFF_AI_LICENSE_KEY=${apiKey}
DASHBOARD_JWT_SECRET=<generate-a-secret>
MASTYFF_AI_CLOUD_JWT_SECRET=<match-cloud-LICENSE_JWT_SECRET-or-AUTH_SECRET>
# Mount ${tenantDir}/policy.yaml → policy-templates/tenants/${org.slug}/policy.yaml
`;
  writeFileSync(envPath, envBlock);

  console.log(`Exported tenant "${org.slug}" to ${outDir}`);
  console.log(`  policy: ${policyPath}`);
  console.log(`  env:    ${envPath}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
