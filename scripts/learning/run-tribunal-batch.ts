#!/usr/bin/env npx tsx
/**
 * Dashboard-triggered semantic tribunal batch — debates uncertain flags and writes report cache.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildTribunalReport } from '../../src/ai/swarm-debate-tribunal.js';
import { DEFAULT_TENANT_ID } from '../../src/tenant/resolve-tenant.js';
import { resolveTenantSwarmDir } from '../../src/tenant/swarm-tenant-paths.js';

const tenantId = process.env.MASTYF_AI_TENANT_ID?.trim() || DEFAULT_TENANT_ID;
const limitRaw = parseInt(process.env.TRIBUNAL_BATCH_LIMIT || '10', 10);
const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 25) : 10;
const useLlm = process.env.TRIBUNAL_USE_LLM === 'true';
const outDir = resolveTenantSwarmDir(tenantId);
const jobPath = join(outDir, 'tribunal-job.json');
const logPath = join(outDir, 'tribunal-job.log');
const reportPath = join(outDir, 'tribunal-report.json');

function log(msg: string): void {
  appendFileSync(logPath, `${msg}\n`);
  console.log(msg);
}

function patchJob(patch: Record<string, unknown>): void {
  mkdirSync(outDir, { recursive: true });
  const existing = existsSync(jobPath)
    ? (JSON.parse(readFileSync(jobPath, 'utf-8')) as Record<string, unknown>)
    : {};
  writeFileSync(jobPath, JSON.stringify({ ...existing, ...patch, tenantId }, null, 2));
}

async function main(): Promise<void> {
  patchJob({
    state: 'running',
    phase: 'debate',
    phaseLabel: 'Debating uncertain semantic flags',
    progressPct: 20,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    error: null,
    pid: process.pid,
  });
  log(`[tribunal] starting batch limit=${limit} useLlm=${useLlm}`);

  try {
    const report = await buildTribunalReport({ tenantId, limit, useLlm });
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    log(
      `[tribunal] wrote ${report.debatedCount} debate(s) · ${report.remainingEligible} remaining · autoLabels=${report.autoLabelsApplied}`,
    );
    patchJob({
      state: 'done',
      phase: 'done',
      phaseLabel: 'Complete',
      progressPct: 100,
      finishedAt: new Date().toISOString(),
      exitCode: 0,
      error: null,
      pid: null,
      debatedCount: report.debatedCount,
      remainingEligible: report.remainingEligible,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`[tribunal] failed: ${message}`);
    patchJob({
      state: 'failed',
      phase: 'failed',
      phaseLabel: 'Failed',
      progressPct: 0,
      finishedAt: new Date().toISOString(),
      exitCode: 1,
      error: message,
      pid: null,
    });
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
