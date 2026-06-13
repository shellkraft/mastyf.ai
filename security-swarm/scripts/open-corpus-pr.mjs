#!/usr/bin/env node
/**
 * Create human-review branches for swarm-generated corpus fixtures (no auto-merge).
 *
 * Usage:
 *   node security-swarm/scripts/open-corpus-pr.mjs [--dry-run]
 *
 * Reads evasion-promotions.json and/or threat-lab-candidates.json.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { verifyEvasionManifest, getEvasionSigningKey } from '../lib/evasion-sign.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dir, '..', '..');
const EVASION_MANIFEST = join(REPO, 'reports', 'security-swarm', 'evasion-promotions.json');
const THREAT_LAB_MANIFEST = join(REPO, 'reports', 'security-swarm', 'threat-lab-candidates.json');
const DRY = process.argv.includes('--dry-run');

function git(...args) {
  const r = spawnSync('git', args, { cwd: REPO, encoding: 'utf-8' });
  if (r.status !== 0) {
    console.error(`[open-corpus-pr] git ${args.join(' ')} failed:\n${r.stderr || r.stdout}`);
    process.exit(1);
  }
  return (r.stdout || '').trim();
}

function verifySignedManifest(manifest, label) {
  if (getEvasionSigningKey()) {
    const verify = verifyEvasionManifest(manifest);
    if (!verify.ok) {
      console.error(`[open-corpus-pr] Invalid ${label} manifest: ${verify.reason}`);
      process.exit(1);
    }
  } else if (manifest.signature) {
    console.error(`[open-corpus-pr] ${label} manifest is signed but MASTYFF_AI_SWARM_EVASION_SIGNING_KEY is unset`);
    process.exit(1);
  }
}

function loadPromotions() {
  const promotions = [];

  if (existsSync(EVASION_MANIFEST)) {
    const manifest = JSON.parse(readFileSync(EVASION_MANIFEST, 'utf-8'));
    verifySignedManifest(manifest, 'evasion');
    for (const p of manifest.promotions || []) {
      promotions.push({ ...p, source: 'evasion' });
    }
  }

  if (existsSync(THREAT_LAB_MANIFEST)) {
    const manifest = JSON.parse(readFileSync(THREAT_LAB_MANIFEST, 'utf-8'));
    verifySignedManifest(manifest, 'threat-lab');
    for (const c of manifest.candidates || []) {
      if (!c.path) continue;
      if (c.attackClass?.startsWith('llm-fallback')) {
        console.warn(`[open-corpus-pr] skip ${c.id}: synthetic fallback candidate rejected`);
        continue;
      }
      if (c.provenance && c.provenance.llmUsed === false) {
        console.warn(`[open-corpus-pr] skip ${c.id}: non-LLM candidate rejected`);
        continue;
      }
      promotions.push({
        id: c.id,
        fingerprint: c.fingerprint,
        path: c.path,
        branch: c.branch || `swarm/threat-lab-${c.id}`,
        toolName: c.corpusCandidate?.toolName,
        source: 'threat-lab',
      });
    }
  }

  return promotions;
}

const promotions = loadPromotions();
if (!promotions.length) {
  console.error(
    '[open-corpus-pr] Missing promotions — run evasion-generate and/or threat-lab (SWARM_THREAT_LAB=true) first',
  );
  process.exit(1);
}

const baseBranch = git('rev-parse', '--abbrev-ref', 'HEAD');
console.log(`[open-corpus-pr] base=${baseBranch} promotions=${promotions.length} dryRun=${DRY}`);

for (const p of promotions) {
  const rel = p.path;
  if (!existsSync(join(REPO, rel))) {
    console.warn(`[open-corpus-pr] skip ${p.id}: missing ${rel}`);
    continue;
  }
  if (DRY) {
    console.log(`[open-corpus-pr] would create branch ${p.branch} with ${rel} (${p.source || 'evasion'})`);
    continue;
  }
  git('checkout', baseBranch);
  git('checkout', '-B', p.branch);
  git('add', rel);
  const msg = `swarm: add corpus fixture ${p.id} from ${p.source || 'bypass'} promotion`;
  const commit = spawnSync('git', ['commit', '-m', msg], { cwd: REPO, encoding: 'utf-8' });
  if (commit.status !== 0 && !String(commit.stderr || '').includes('nothing to commit')) {
    console.error(`[open-corpus-pr] commit failed for ${p.id}`);
    process.exit(1);
  }
  console.log(`[open-corpus-pr] branch ${p.branch} ready — push and open PR manually:`);
  console.log(`  git push -u origin ${p.branch}`);
  console.log(
    `  gh pr create --head ${p.branch} --title "Swarm corpus: ${p.id}" --body "Human review required. Run pnpm security-swarm:fast before merge."`,
  );
}

if (!DRY) git('checkout', baseBranch);
console.log('[open-corpus-pr] Done. No auto-merge — human review required.');
