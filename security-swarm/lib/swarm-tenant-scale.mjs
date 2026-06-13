/**
 * H16 — Scale swarm across tenant-scoped artifact directories in parallel.
 *
 * Usage:
 *   SWARM_TENANT_DIRS=default,acme,beta node security-swarm/lib/swarm-tenant-scale.mjs --fast
 */
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dir, '..', '..');
const RUN = join(__dir, '..', 'run.mjs');

const tenants = (process.env.SWARM_TENANT_DIRS || 'default')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const extraArgs = process.argv.slice(2);

function runTenant(tenantId) {
  const swarmDir = join(REPO, 'reports', 'tenants', tenantId, 'security-swarm');
  mkdirSync(swarmDir, { recursive: true });
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [RUN, ...extraArgs], {
      cwd: REPO,
      env: { ...process.env, MASTYFF_AI_SWARM_DIR: swarmDir, MASTYFF_AI_TENANT_ID: tenantId },
      stdio: 'inherit',
    });
    child.on('exit', (code) => resolve({ tenantId, code: code ?? 1 }));
  });
}

const results = await Promise.all(tenants.map(runTenant));
const failed = results.filter((r) => r.code !== 0);
if (failed.length > 0) {
  console.error('[swarm-tenant-scale] failed tenants:', failed.map((f) => f.tenantId).join(', '));
  process.exit(1);
}
console.log('[swarm-tenant-scale] all tenants passed:', tenants.join(', '));
