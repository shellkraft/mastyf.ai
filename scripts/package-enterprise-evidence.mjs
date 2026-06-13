#!/usr/bin/env node
/**
 * Bundle CI-gated evidence for procurement / security review.
 * Output: reports/enterprise-evidence-pack/
 */
import { mkdirSync, copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const OUT = join(ROOT, 'reports', 'enterprise-evidence-pack');

const ARTIFACTS = [
  ['corpus-eval-report.json', 'corpus-eval-report.json'],
  ['reports/adversarial-harness/results.json', 'adversarial-harness-results.json'],
  ['reports/adversarial-harness/summary.md', 'adversarial-harness-summary.md'],
  ['reports/attack-learning-eval/metrics.json', 'attack-learning-eval-metrics.json'],
  ['reports/enterprise-findings-fixes/summary.md', 'enterprise-findings-fixes-summary.md'],
  ['docs/PEN_TEST_REPORT.md', 'PEN_TEST_REPORT.md'],
  ['docs/DISASTER_RECOVERY.md', 'DISASTER_RECOVERY.md'],
  ['docs/THREAT_MODEL.md', 'THREAT_MODEL.md'],
  ['security/ATTACK_MATRIX.md', 'ATTACK_MATRIX.md'],
];

mkdirSync(OUT, { recursive: true });

const copied = [];
const missing = [];

for (const [srcRel, destName] of ARTIFACTS) {
  const src = join(ROOT, srcRel);
  const dest = join(OUT, destName);
  if (!existsSync(src)) {
    missing.push(srcRel);
    continue;
  }
  copyFileSync(src, dest);
  copied.push(destName);
}

let gitHead = 'unknown';
try {
  gitHead = execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf-8' }).trim();
} catch {
  /* ignore */
}

const manifest = {
  generatedAt: new Date().toISOString(),
  gitHead,
  copied,
  missing,
  regenerate: {
    corpus: 'MASTYFF_AI_DISABLE_SEMANTIC=true pnpm eval',
    adversarial: './adversarial-harness/run-all.sh',
    tests: 'pnpm test',
    integration: 'pnpm test:integration',
  },
};

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
writeFileSync(
  join(OUT, 'README.txt'),
  `MCP Mastyff AI enterprise evidence pack\nGenerated: ${manifest.generatedAt}\nCommit: ${gitHead}\n\nSee docs/ENTERPRISE_EVIDENCE_PACK.md for interpretation.\n`,
);

console.log(JSON.stringify({ ok: true, outDir: OUT, copied: copied.length, missing }, null, 2));
if (missing.length > 0) process.exitCode = 0;
