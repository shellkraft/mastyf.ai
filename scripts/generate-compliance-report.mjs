#!/usr/bin/env node
/**
 * Generate SOC2-oriented compliance evidence summary from local artifacts.
 * Usage: node scripts/generate-compliance-report.mjs
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'reports', 'compliance-pack');

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

function section(title, lines) {
  return `## ${title}\n\n${lines.filter(Boolean).join('\n')}\n`;
}

mkdirSync(OUT, { recursive: true });

const corpus = readJson(join(ROOT, 'corpus-eval-report.json'));
const latest = readJson(join(ROOT, 'reports', 'security-swarm', 'latest.json'));
const evidenceDir = join(ROOT, 'reports', 'enterprise-evidence-pack');
const evidenceFiles = existsSync(evidenceDir) ? readdirSync(evidenceDir) : [];

const md = [
  '# MCP Mastyff AI — Compliance Evidence Summary',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  section('Security testing', [
    corpus
      ? `- Corpus eval: ${corpus.overallPassRate ?? 'n/a'} pass rate (${corpus.total ?? '?'} cases)`
      : '- Corpus eval: run `pnpm verify:corpus`',
    latest
      ? `- Security swarm gates: ${latest.overall === true ? 'PASS' : latest.overall === false ? 'FAIL' : 'unknown'}`
      : '- Security swarm: run `pnpm security-swarm:fast`',
    '- Adversarial harness: `pnpm test:adversarial`',
    '- Integration matrix: `pnpm test:integration`',
  ]),
  section('Enterprise controls (v2.9.3+)', [
    '- Multi-tenant logical isolation: `docs/MULTI_TENANCY.md`',
    '- Response DLP modes: `MASTYFF_AI_RESPONSE_DLP_MODE=block|redact|audit`',
    '- SIEM exporter DLQ: `~/.mastyff-ai/exporter-dlq/pending.jsonl`',
    '- Field encryption: `MASTYFF_AI_DB_ENCRYPTION_KEY` + optional `MASTYFF_AI_DB_ENCRYPTION_SALT`',
    '- JWT max lifetime: `MASTYFF_AI_JWT_MAX_LIFETIME_SEC` (default 86400)',
    '- Token revocation API: `revokeBearerToken()` in `src/auth/token-revocation.ts`',
    '- mTLS hot-reload: `MtlsCertWatcher` + `mtls-agent-registry`',
    '- OPA result schema validation in `opa-policy.ts`',
    '- Cluster rug-pull registry when `REDIS_URL` set',
  ]),
  section('Packaged artifacts', evidenceFiles.map((f) => `- ${f}`)),
  section('Operator commands', [
    '```bash',
    'pnpm enterprise:preflight',
    'pnpm enterprise:evidence-pack',
    'node scripts/generate-compliance-report.mjs',
    '```',
  ]),
].join('\n');

writeFileSync(join(OUT, 'COMPLIANCE_SUMMARY.md'), md + '\n');
writeFileSync(
  join(OUT, 'manifest.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      sections: ['security-testing', 'enterprise-controls', 'artifacts'],
      evidencePack: evidenceFiles,
    },
    null,
    2,
  ) + '\n',
);

console.log(`Wrote ${join(OUT, 'COMPLIANCE_SUMMARY.md')}`);
