#!/usr/bin/env node
/**
 * Scout agent — dependency audit (supply-chain signal). No mocks.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dir, '..', '..');
const OUT_DIR = join(REPO, 'reports', 'security-swarm');

mkdirSync(OUT_DIR, { recursive: true });

// Audit runtime/production deps only for swarm gating. Dev-tool advisories
// (e.g. test runners) are tracked separately and should not fail live gates.
const r = spawnSync('pnpm', ['audit', '--prod', '--audit-level=high', '--json'], {
  cwd: REPO,
  encoding: 'utf-8',
  env: process.env,
});

let audit = { ok: false, status: r.status, advisories: [] };
try {
  const parsed = JSON.parse(r.stdout || '{}');
  const meta = parsed.metadata?.vulnerabilities || {};
  audit.summary = meta;
  audit.ok = (meta.high || 0) === 0 && (meta.critical || 0) === 0;
} catch {
  audit.parseError = (r.stderr || r.stdout || '').slice(0, 2000);
  audit.ok = false;
}

const out = {
  agent: 'scout',
  timestamp: new Date().toISOString(),
  audit,
};

writeFileSync(join(OUT_DIR, 'scout.json'), JSON.stringify(out, null, 2));
console.log(`[scout] dependency audit: ${audit.ok ? 'PASS' : 'FAIL'}`);
if (audit.summary) {
  console.log(
    `[scout] critical=${audit.summary.critical ?? 0} high=${audit.summary.high ?? 0} moderate=${audit.summary.moderate ?? 0} low=${audit.summary.low ?? 0}`,
  );
}
process.exit(audit.ok ? 0 : 1);
