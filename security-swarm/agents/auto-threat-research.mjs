#!/usr/bin/env node
/**
 * Auto Threat Research agent — LLM discovery → adv fixtures (no human review).
 * Delegates to scripts/security-swarm/run-auto-threat-research.ts
 */
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dir, '..', '..');

if (process.env.SWARM_THREAT_RESEARCH_AUTO !== 'true') {
  console.log('[auto-threat-research] SWARM_THREAT_RESEARCH_AUTO not enabled — skipping');
  process.exit(0);
}

const script = join(REPO, 'scripts', 'security-swarm', 'run-auto-threat-research.ts');
if (!existsSync(script)) {
  console.error('[auto-threat-research] Missing run-auto-threat-research.ts');
  process.exit(1);
}

const r = spawnSync('node', ['--import', 'tsx', script], {
  cwd: REPO,
  stdio: 'inherit',
  env: {
    ...process.env,
    MASTYFF_AI_THREAT_RESEARCH_AUTO: process.env.MASTYFF_AI_THREAT_RESEARCH_AUTO ?? 'true',
  },
});

process.exit(r.status ?? 1);
