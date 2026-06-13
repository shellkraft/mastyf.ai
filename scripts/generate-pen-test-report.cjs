#!/usr/bin/env node
/**
 * Generates docs/PEN_TEST_REPORT.md from corpus-eval-report.json and vitest summary.
 * Usage: node scripts/generate-pen-test-report.cjs
 */
const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const ROOT = join(__dirname, '..');
const CORPUS_REPORT = join(ROOT, 'corpus-eval-report.json');
const BENCH_REPORT = join(ROOT, 'benchmark-report.json');
const OUT = join(ROOT, 'docs', 'PEN_TEST_REPORT.md');

function loadJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

const corpus = loadJson(CORPUS_REPORT);
const bench = loadJson(BENCH_REPORT);
const date = new Date().toISOString().slice(0, 10);

let body = `# MCP Mastyff AI Penetration Test Report

**Version:** 2.7.5  
**Report date:** ${date}  
**Scope:** Policy engine (\`default-policy.yaml\`), enterprise LLM/MCP corpus, adversarial unit + E2E tests

---

## Executive summary

`;

if (corpus) {
  body += `Automated corpus evaluation ran **${corpus.totalEntries}** tool-call fixtures against \`PolicyEngine\` with \`default-policy.yaml\`.

| Metric | Value |
|--------|-------|
| Attack block rate | ${(corpus.attackBlockRate * 100).toFixed(1)}% |
| Benign pass rate | ${(corpus.benignPassRate * 100).toFixed(1)}% |
| Precision | ${(corpus.overall.precision * 100).toFixed(1)}% |
| Recall | ${(corpus.overall.recall * 100).toFixed(1)}% |
| F1 | ${(corpus.overall.f1 * 100).toFixed(1)}% |
| Status | ${corpus.passed ? '**PASS**' : '**FAIL**'} |

### Per-category recall

| Category | Entries | Recall | Failures |
|----------|---------|--------|----------|
`;
  for (const c of corpus.byCategory) {
    const attacks = c.category !== 'benign';
    const recall = attacks ? `${(c.recall * 100).toFixed(1)}%` : 'N/A (benign)';
    body += `| ${c.category} | ${c.total} | ${recall} | ${c.failures.length} |\n`;
  }
} else {
  body += `_Corpus report not found. Run \`pnpm eval\` first._\n`;
}

body += `
---

## Performance (proxy benchmarks)

`;

if (bench) {
  const b = bench.scenarios.blocking;
  body += `| Metric | Blocking policy |
|--------|-----------------|
| p50 | ${b.p50}ms |
| p95 | ${b.p95}ms |
| p99 | ${b.p99}ms |
| Threshold | ${bench.p95ThresholdMs}ms |
| CI gate | ${bench.passed ? 'PASS' : 'FAIL'} |

`;
} else {
  body += `_Benchmark report not found. Run \`pnpm exec tsx benchmarks/run.ts\`._\n\n`;
}

body += `---

## Test coverage

| Suite | Description |
|-------|-------------|
| \`tests/policy/adversarial-scenarios.test.ts\` | 58+ inline adversarial cases (default-policy) |
| \`corpus/run-eval.ts\` | ${corpus?.totalEntries ?? '200+'} enterprise corpus entries |
| \`tests/e2e/adversarial-proxy.e2e.test.ts\` | 10 corpus attacks through live proxy subprocess |
| \`tests/e2e/proxy-with-policy.e2e.test.ts\` | Safe pass + block smoke tests |

See [security/ATTACK_MATRIX.md](../security/ATTACK_MATRIX.md) for OWASP MCP / LLM threat mapping.

---

## Methodology

1. **Corpus eval** — each JSON fixture evaluated synchronously via \`PolicyEngine.evaluate()\`.
2. **E2E proxy** — child process \`mastyff-ai proxy\` with real \`default-policy.yaml\`; blocked calls return JSON-RPC \`-32001\`.
3. **Benchmarks** — 1000 (CI: 100) round-trips; p95 gate on blocking-policy scenario.

---

## Regenerate

\`\`\`bash
pnpm build && pnpm eval
BENCH_ITERATIONS=100 pnpm exec tsx benchmarks/run.ts
node scripts/generate-pen-test-report.cjs
\`\`\`
`;

writeFileSync(OUT, body);
console.log('Wrote', OUT);
