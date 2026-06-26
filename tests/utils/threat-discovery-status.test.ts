import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, utimesSync } from 'fs';
import { join } from 'path';
import {
  buildThreatDiscoveryStatus,
  resetThreatDiscoveryStatusCacheForTests,
} from '../../src/utils/threat-discovery-status.js';
import { resetThreatResearchQueueForTests } from '../../src/ai/threat-research-pipeline.js';
import { resetDashboardSessionForTests } from '../../src/utils/swarm-session.js';

const TENANT = 'test-threat-status';
const TENANT_DIR = join(process.cwd(), 'reports', 'tenants', TENANT, 'security-swarm');

function writeSessionJob() {
  writeFileSync(
    join(TENANT_DIR, 'threat-lab-job.json'),
    JSON.stringify({
      jobId: 'session-test',
      state: 'done',
      startedAt: new Date().toISOString(),
    }),
  );
}

describe('buildThreatDiscoveryStatus', () => {
  beforeEach(() => {
    resetDashboardSessionForTests(Date.now());
    resetThreatResearchQueueForTests();
    resetThreatDiscoveryStatusCacheForTests();
    mkdirSync(TENANT_DIR, { recursive: true });
  });

  afterEach(() => {
    resetThreatResearchQueueForTests();
    resetThreatDiscoveryStatusCacheForTests();
    const tenantRoot = join(process.cwd(), 'reports', 'tenants', TENANT);
    if (existsSync(tenantRoot)) rmSync(tenantRoot, { recursive: true, force: true });
  });

  it('aggregates threat lab and auto corpus manifests', async () => {
    writeSessionJob();
    writeFileSync(
      join(TENANT_DIR, 'threat-lab-candidates.json'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        count: 1,
        mode: 'reactive',
        candidates: [
          {
            id: 'adv-test-1',
            fingerprint: 'abc',
            attackClass: 'test-class',
            hypothesis: 'test hypothesis',
            confidence: 0.9,
            provenance: { source: 'bypass', llmUsed: true },
            reviewStatus: 'pending',
          },
        ],
      }),
    );
    writeFileSync(
      join(TENANT_DIR, 'auto-corpus-manifest.json'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        count: 1,
        entries: [
          {
            advId: 'adv-999',
            relPath: 'adversarial-harness/fixtures/custom-attacks/adv-999.json',
            fingerprint: 'def',
            source: 'semantic_flag',
            attackClass: 'test',
            hypothesis: 'auto hypothesis',
            confidence: 0.88,
            timestamp: new Date().toISOString(),
            toolName: 'read_file',
            category: 'test',
          },
        ],
      }),
    );

    const status = await buildThreatDiscoveryStatus(TENANT);
    expect(status.threatLab.stats.total).toBe(1);
    expect(status.threatLab.stats.pending).toBe(1);
    expect(status.autoCorpus.stats.total).toBe(1);
    expect(status.pipeline).toBeDefined();
    expect(status.jobs.threatLab.state).toBeDefined();
  });

  it('hides stale manifests when no session job ran', async () => {
    writeFileSync(
      join(TENANT_DIR, 'threat-lab-candidates.json'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        count: 1,
        candidates: [{ id: 'adv-stale', fingerprint: 'x', attackClass: 'a', hypothesis: 'h', confidence: 0.9 }],
      }),
    );

    const status = await buildThreatDiscoveryStatus(TENANT);
    expect(status.threatLab.stats.total).toBe(0);
    expect(status.provenance.sessionActive).toBe(false);
  });

  it('reads auto corpus via ungated fallback when manifest predates latest job', async () => {
    writeSessionJob();
    writeFileSync(
      join(TENANT_DIR, 'auto-corpus-manifest.json'),
      JSON.stringify({
        timestamp: new Date(Date.now() - 3600_000).toISOString(),
        count: 1,
        entries: [
          {
            advId: 'adv-ungated',
            relPath: 'adversarial-harness/fixtures/custom-attacks/adv-ungated.json',
            fingerprint: 'fp',
            source: 'bypass',
            attackClass: 'test',
            hypothesis: 'h',
            confidence: 0.9,
            timestamp: new Date().toISOString(),
            toolName: 'read_file',
            category: 'test',
          },
        ],
      }),
    );
    const old = (Date.now() - 3600_000) / 1000;
    utimesSync(join(TENANT_DIR, 'auto-corpus-manifest.json'), old, old);

    const status = await buildThreatDiscoveryStatus(TENANT);
    expect(status.autoCorpus.stats.total).toBe(1);
    expect(status.autoCorpus.manifest?.entries?.[0]?.advId).toBe('adv-ungated');
  });

  it('returns empty stats when no manifests exist', async () => {
    const tlPath = join(TENANT_DIR, 'threat-lab-candidates.json');
    const acPath = join(TENANT_DIR, 'auto-corpus-manifest.json');
    if (existsSync(tlPath)) rmSync(tlPath);
    if (existsSync(acPath)) rmSync(acPath);

    const status = await buildThreatDiscoveryStatus(TENANT);
    expect(status.threatLab.stats.total).toBe(0);
    expect(status.autoCorpus.stats.total).toBe(0);
  });
});
