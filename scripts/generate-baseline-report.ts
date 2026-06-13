import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = import.meta.dirname ? join(import.meta.dirname, '..') : process.cwd();
const REPORTS_DIR = join(ROOT, 'reports');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const RUN_DIR = join(REPORTS_DIR, TIMESTAMP);

// ─── Helpers ────────────────────────────────────────────────────────────────

function run(cmd: string, label: string): { success: boolean; stdout: string; duration: number } {
  console.log(`\n${'━'.repeat(60)}`);
  console.log(`  Running: ${label}`);
  console.log(`  Command: ${cmd}`);
  console.log(`${'━'.repeat(60)}\n`);

  const start = Date.now();
  try {
    const stdout = execSync(cmd, {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'inherit', 'inherit'], // stream stdout/stderr live
      timeout: 600_000, // 10 min max
      env: { ...process.env, FORCE_COLOR: '1' },
    });
    const duration = Date.now() - start;
    console.log(`\n  Done in ${(duration / 1000).toFixed(1)}s`);
    return { success: true, stdout: stdout || '', duration };
  } catch (e: any) {
    const duration = Date.now() - start;
    console.log(`\n  Failed after ${(duration / 1000).toFixed(1)}s`);
    return { success: false, stdout: e.stdout?.toString() || e.message, duration };
  }
}

function tryReadJson(path: string): any {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║        MCP Mastyff AI — Full Report Generation                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`  Output directory: ${RUN_DIR}\n`);

  mkdirSync(RUN_DIR, { recursive: true });

  const summary: Record<string, any> = {
    timestamp: new Date().toISOString(),
    machine: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    sections: {},
  };

  // ─── 1. Tests ────────────────────────────────────────────────────────────

  const testResult = run('pnpm exec vitest run', 'Unit & Integration Tests');
  summary.sections.tests = { success: testResult.success, durationMs: testResult.duration };

  // Copy test results
  const testJsonPath = join(ROOT, 'test-results', 'results.json');
  const testJunitPath = join(ROOT, 'test-results', 'junit.xml');
  if (existsSync(testJsonPath)) {
    copyFileSync(testJsonPath, join(RUN_DIR, 'test-results.json'));
    const testData = tryReadJson(testJsonPath);
    if (testData) {
      summary.sections.tests.totalSuites = testData.numTotalTestSuites;
      summary.sections.tests.totalTests = testData.numTotalTests;
      summary.sections.tests.passed = testData.numPassedTests;
      summary.sections.tests.failed = testData.numFailedTests;
      summary.sections.tests.skipped = testData.numPendingTests;
    }
  }
  if (existsSync(testJunitPath)) {
    copyFileSync(testJunitPath, join(RUN_DIR, 'test-junit.xml'));
  }

  // ─── 2. Coverage ─────────────────────────────────────────────────────────

  const covResult = run('pnpm exec vitest run --coverage', 'Code Coverage');
  summary.sections.coverage = { success: covResult.success, durationMs: covResult.duration };

  const covJsonPath = join(ROOT, 'coverage', 'coverage-summary.json');
  if (existsSync(covJsonPath)) {
    copyFileSync(covJsonPath, join(RUN_DIR, 'coverage-summary.json'));
    const covData = tryReadJson(covJsonPath);
    if (covData?.total) {
      summary.sections.coverage.lines = covData.total.lines?.pct;
      summary.sections.coverage.functions = covData.total.functions?.pct;
      summary.sections.coverage.branches = covData.total.branches?.pct;
      summary.sections.coverage.statements = covData.total.statements?.pct;
    }
  }

  // ─── 3. Benchmarks (proxy latency) ───────────────────────────────────────

  const benchResult = run('pnpm exec tsx benchmarks/run.ts', 'Proxy Latency Benchmark');
  summary.sections.benchmark = { success: benchResult.success, durationMs: benchResult.duration };

  const benchJsonPath = join(ROOT, 'benchmark-report.json');
  if (existsSync(benchJsonPath)) {
    copyFileSync(benchJsonPath, join(RUN_DIR, 'benchmark-latency.json'));
    const benchData = tryReadJson(benchJsonPath);
    if (benchData) {
      summary.sections.benchmark.iterations = benchData.iterations;
      summary.sections.benchmark.scenarios = benchData.scenarios;
      summary.sections.benchmark.overheadMs = benchData.overheadMs;
      summary.sections.benchmark.p95Passed = benchData.passed;
    }
  }

  // ─── 4. Concurrent Benchmark ─────────────────────────────────────────────

  const concResult = run('pnpm exec tsx benchmarks/concurrent-tool-calls.ts', 'Concurrent Tool Calls (1000)');
  summary.sections.concurrent = { success: concResult.success, durationMs: concResult.duration };

  const concJsonPath = join(ROOT, 'benchmarks', 'results', 'concurrent-tool-calls-latest.json');
  if (existsSync(concJsonPath)) {
    copyFileSync(concJsonPath, join(RUN_DIR, 'benchmark-concurrent.json'));
    const concData = tryReadJson(concJsonPath);
    if (concData) {
      summary.sections.concurrent.correctness = concData.correctness;
      summary.sections.concurrent.latencyMs = concData.latencyMs;
      summary.sections.concurrent.throughput = concData.throughput;
      summary.sections.concurrent.sloResults = concData.sloResults;
    }
  }

  // ─── 5. Corpus Eval (Detection Recall) ────────────────────────────────────

  const evalResult = run('pnpm exec tsx corpus/run-eval.ts', 'Corpus Detection Eval');
  summary.sections.corpusEval = { success: evalResult.success, durationMs: evalResult.duration };

  const evalJsonPath = join(ROOT, 'corpus-eval-report.json');
  if (existsSync(evalJsonPath)) {
    copyFileSync(evalJsonPath, join(RUN_DIR, 'corpus-eval.json'));
    const evalData = tryReadJson(evalJsonPath);
    if (evalData) {
      summary.sections.corpusEval.totalEntries = evalData.totalEntries;
      summary.sections.corpusEval.overall = evalData.overall;
      summary.sections.corpusEval.attackBlockRate = evalData.attackBlockRate;
      summary.sections.corpusEval.benignPassRate = evalData.benignPassRate;
      summary.sections.corpusEval.byCategory = evalData.byCategory;
    }
  }

  // ─── Write Summary JSON ──────────────────────────────────────────────────

  writeFileSync(join(RUN_DIR, 'summary.json'), JSON.stringify(summary, null, 2));

  // ─── Generate Markdown Report ─────────────────────────────────────────────

  const md = generateMarkdown(summary);
  writeFileSync(join(RUN_DIR, 'REPORT.md'), md);

  // Also write latest symlink-style copy at reports root
  writeFileSync(join(REPORTS_DIR, 'latest-summary.json'), JSON.stringify(summary, null, 2));
  writeFileSync(join(REPORTS_DIR, 'LATEST_REPORT.md'), md);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    Report Complete                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`  Full report:   ${join(RUN_DIR, 'REPORT.md')}`);
  console.log(`  Summary JSON:  ${join(RUN_DIR, 'summary.json')}`);
  console.log(`  Latest report: ${join(REPORTS_DIR, 'LATEST_REPORT.md')}`);
  console.log('');
}

// ─── Markdown Generator ─────────────────────────────────────────────────────

function generateMarkdown(summary: Record<string, any>): string {
  const s = summary.sections;
  let md = '';

  md += `# MCP Mastyff AI — Baseline Report\n\n`;
  md += `**Generated:** ${summary.timestamp}  \n`;
  md += `**Node:** ${summary.machine.node} | **Platform:** ${summary.machine.platform}/${summary.machine.arch}\n\n`;
  md += `---\n\n`;

  // Tests
  md += `## 1. Test Results\n\n`;
  if (s.tests) {
    const t = s.tests;
    md += `| Metric | Value |\n|--------|-------|\n`;
    md += `| Status | ${t.success ? 'PASSED' : 'FAILED'} |\n`;
    md += `| Total Tests | ${t.totalTests ?? 'N/A'} |\n`;
    md += `| Passed | ${t.passed ?? 'N/A'} |\n`;
    md += `| Failed | ${t.failed ?? 'N/A'} |\n`;
    md += `| Skipped | ${t.skipped ?? 'N/A'} |\n`;
    md += `| Duration | ${((t.durationMs || 0) / 1000).toFixed(1)}s |\n`;
  }
  md += `\n`;

  // Coverage
  md += `## 2. Code Coverage\n\n`;
  if (s.coverage) {
    const c = s.coverage;
    md += `| Metric | Value | Threshold |\n|--------|-------|----------|\n`;
    md += `| Lines | ${c.lines ?? 'N/A'}% | 58% |\n`;
    md += `| Functions | ${c.functions ?? 'N/A'}% | 65% |\n`;
    md += `| Branches | ${c.branches ?? 'N/A'}% | 55% |\n`;
    md += `| Statements | ${c.statements ?? 'N/A'}% | 58% |\n`;
  }
  md += `\n`;

  // Benchmark Latency
  md += `## 3. Proxy Latency Benchmark\n\n`;
  if (s.benchmark?.scenarios) {
    const b = s.benchmark;
    md += `**Iterations:** ${b.iterations} | **P95 SLO:** ${b.p95Passed ? 'PASSED' : 'FAILED'}\n\n`;
    md += `| Scenario | p50 | p95 | p99 | avg |\n|----------|-----|-----|-----|-----|\n`;
    for (const [name, stats] of Object.entries(b.scenarios) as any) {
      md += `| ${name} | ${stats.p50.toFixed(1)}ms | ${stats.p95.toFixed(1)}ms | ${stats.p99.toFixed(1)}ms | ${stats.avg.toFixed(1)}ms |\n`;
    }
    md += `\n**Overhead vs baseline:** No-policy: +${b.overheadMs?.noPolicy?.toFixed(1) ?? '?'}ms | With-policy: +${b.overheadMs?.withPolicy?.toFixed(1) ?? '?'}ms\n`;
  } else {
    md += `Benchmark did not produce results. ${s.benchmark?.success === false ? '(FAILED)' : ''}\n`;
  }
  md += `\n`;

  // Concurrent
  md += `## 4. Concurrent Load Test\n\n`;
  if (s.concurrent?.correctness) {
    const c = s.concurrent;
    md += `| Metric | Value |\n|--------|-------|\n`;
    md += `| Total Calls | ${c.correctness.total} |\n`;
    md += `| Correctness | ${c.correctness.correctnessPct}% |\n`;
    md += `| Passed | ${c.correctness.passed} |\n`;
    md += `| Failed | ${c.correctness.failed} |\n`;
    md += `| p50 Latency | ${c.latencyMs?.p50?.toFixed(1) ?? 'N/A'}ms |\n`;
    md += `| p95 Latency | ${c.latencyMs?.p95?.toFixed(1) ?? 'N/A'}ms |\n`;
    md += `| p99 Latency | ${c.latencyMs?.p99?.toFixed(1) ?? 'N/A'}ms |\n`;
    md += `| Throughput | ${c.throughput?.evaluationsPerSecond?.toFixed(0) ?? 'N/A'} eval/s |\n`;
    md += `| SLO Pass | ${c.sloResults?.overallPass ? 'YES' : 'NO'} |\n`;
  } else {
    md += `Concurrent benchmark did not produce results.\n`;
  }
  md += `\n`;

  // Corpus Eval
  md += `## 5. Detection Recall (Corpus Eval)\n\n`;
  if (s.corpusEval?.overall) {
    const e = s.corpusEval;
    md += `**Total entries:** ${e.totalEntries}\n\n`;
    md += `| Metric | Value |\n|--------|-------|\n`;
    md += `| Precision | ${(e.overall.precision * 100).toFixed(1)}% |\n`;
    md += `| Recall | ${(e.overall.recall * 100).toFixed(1)}% |\n`;
    md += `| F1 Score | ${(e.overall.f1 * 100).toFixed(1)}% |\n`;
    md += `| Attack Block Rate | ${(e.attackBlockRate * 100).toFixed(1)}% |\n`;
    md += `| Benign Pass Rate | ${(e.benignPassRate * 100).toFixed(1)}% |\n`;
    md += `| True Positives | ${e.overall.tp} |\n`;
    md += `| False Positives | ${e.overall.fp} |\n`;
    md += `| True Negatives | ${e.overall.tn} |\n`;
    md += `| False Negatives | ${e.overall.fn} |\n`;
    md += `\n`;

    if (e.byCategory?.length) {
      md += `### Per-Category Breakdown\n\n`;
      md += `| Category | Total | TP | FP | FN | Precision | Recall |\n`;
      md += `|----------|-------|----|----|----|-----------|---------|\n`;
      for (const cat of e.byCategory) {
        const prec = cat.precision != null ? (cat.precision * 100).toFixed(0) + '%' : 'N/A';
        const rec = cat.recall != null ? (cat.recall * 100).toFixed(0) + '%' : 'N/A';
        md += `| ${cat.category} | ${cat.total} | ${cat.tp} | ${cat.fp} | ${cat.fn} | ${prec} | ${rec} |\n`;
      }
    }
  } else {
    md += `Corpus eval did not produce results.\n`;
  }
  md += `\n`;

  // Summary
  md += `---\n\n## Summary\n\n`;
  md += `| Section | Status | Duration |\n|---------|--------|----------|\n`;
  for (const [name, data] of Object.entries(s) as any) {
    md += `| ${name} | ${data.success ? 'PASS' : 'FAIL'} | ${((data.durationMs || 0) / 1000).toFixed(1)}s |\n`;
  }
  md += `\n`;

  return md;
}

main().catch((e) => {
  console.error('Report generation failed:', e);
  process.exit(1);
});
