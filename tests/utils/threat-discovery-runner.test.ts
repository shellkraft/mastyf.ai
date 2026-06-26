import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  getThreatDiscoveryJobStatus,
  isThreatDiscoveryJobRunning,
  reconcileStaleThreatDiscoveryJob,
  resetThreatDiscoveryRunnerForTests,
} from '../../src/utils/threat-discovery-runner.js';
import { ensureTenantSwarmDir } from '../../src/utils/swarm-artifacts.js';

const TENANT = 'test-threat-runner';

describe('threat-discovery-runner', () => {
  beforeEach(() => {
    resetThreatDiscoveryRunnerForTests();
    ensureTenantSwarmDir(TENANT);
  });

  afterEach(() => {
    resetThreatDiscoveryRunnerForTests();
    for (const kind of ['threat-lab', 'auto-research'] as const) {
      const p = join(
        ensureTenantSwarmDir(TENANT),
        kind === 'threat-lab' ? 'threat-lab-job.json' : 'auto-research-job.json',
      );
      if (existsSync(p)) rmSync(p);
      const log = join(
        ensureTenantSwarmDir(TENANT),
        kind === 'threat-lab' ? 'threat-lab-job.log' : 'auto-research-job.log',
      );
      if (existsSync(log)) rmSync(log);
    }
  });

  it('returns idle job status when no job file', () => {
    const st = getThreatDiscoveryJobStatus(TENANT, 'threat-lab');
    expect(st.state).toBe('idle');
    expect(isThreatDiscoveryJobRunning(TENANT, 'threat-lab')).toBe(false);
  });

  it('reads running job from job file', () => {
    const dir = ensureTenantSwarmDir(TENANT);
    writeFileSync(
      join(dir, 'threat-lab-job.json'),
      JSON.stringify({
        jobId: 'test-job',
        state: 'running',
        phase: 'discover',
        phaseLabel: 'Threat Lab discovery',
        progressPct: 50,
        startedAt: new Date().toISOString(),
        pid: process.pid,
      }),
    );
    const st = getThreatDiscoveryJobStatus(TENANT, 'threat-lab');
    expect(st.state).toBe('running');
    expect(st.jobId).toBe('test-job');
  });

  it('reconciles orphaned auto-research job from log summary', () => {
    const dir = ensureTenantSwarmDir(TENANT);
    writeFileSync(
      join(dir, 'auto-research-job.json'),
      JSON.stringify({
        jobId: 'orphan',
        state: 'running',
        phase: 'process',
        progressPct: 70,
        startedAt: new Date().toISOString(),
        pid: 999999,
      }),
    );
    writeFileSync(
      join(dir, 'auto-research-job.log'),
      `[start] Starting auto-research
[auto-threat-research] wrote 0/2 fixture(s)
  ✗ duplicate fingerprint
`,
    );
    const changed = reconcileStaleThreatDiscoveryJob(TENANT, 'auto-research');
    expect(changed).toBe(true);
    const st = getThreatDiscoveryJobStatus(TENANT, 'auto-research');
    expect(st.state).toBe('done');
    expect(st.exitCode).toBe(0);
  });

  it('respects child-written terminal job state', () => {
    const dir = ensureTenantSwarmDir(TENANT);
    writeFileSync(
      join(dir, 'auto-research-job.json'),
      JSON.stringify({
        jobId: 'child-done',
        state: 'done',
        phase: 'done',
        progressPct: 100,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        exitCode: 0,
        pid: null,
        writtenCount: 1,
        attemptedCount: 2,
      }),
    );
    const st = getThreatDiscoveryJobStatus(TENANT, 'auto-research');
    expect(st.state).toBe('done');
    expect(st.exitCode).toBe(0);
  });
});
