import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, utimesSync } from 'fs';
import { join } from 'path';
import {
  dashboardSessionStartedMs,
  getSessionJobStartedMs,
  isSwarmArtifactVisibleForSession,
  isSwarmSessionActiveForTenant,
  resetDashboardSessionForTests,
} from '../../src/utils/swarm-session.js';

const TENANT = 'test-swarm-session';
const TENANT_DIR = join(process.cwd(), 'reports', 'tenants', TENANT, 'security-swarm');

describe('swarm-session', () => {
  beforeEach(() => {
    resetDashboardSessionForTests(Date.now());
    mkdirSync(TENANT_DIR, { recursive: true });
  });

  afterEach(() => {
    const tenantRoot = join(process.cwd(), 'reports', 'tenants', TENANT);
    if (existsSync(tenantRoot)) rmSync(tenantRoot, { recursive: true, force: true });
  });

  it('hides legacy committed artifacts unless session job and opt-in env', () => {
    const legacyDir = join(process.cwd(), 'reports', 'security-swarm');
    mkdirSync(legacyDir, { recursive: true });
    const artifact = join(legacyDir, 'latest-stale-test.json');
    writeFileSync(artifact, '{}');
    writeFileSync(
      join(TENANT_DIR, 'job.json'),
      JSON.stringify({
        jobId: 'old',
        state: 'done',
        startedAt: new Date(dashboardSessionStartedMs - 60_000).toISOString(),
      }),
    );
    const now = Date.now() / 1000;
    utimesSync(artifact, now, now);

    expect(isSwarmSessionActiveForTenant(TENANT)).toBe(true);
    expect(isSwarmArtifactVisibleForSession(artifact, TENANT)).toBe(false);
    rmSync(artifact, { force: true });
  });

  it('exposes tenant artifacts after dashboard restart when job completed', () => {
    const artifact = join(TENANT_DIR, 'latest.json');
    writeFileSync(artifact, '{}');
    writeFileSync(
      join(TENANT_DIR, 'job.json'),
      JSON.stringify({
        jobId: 'old',
        state: 'done',
        startedAt: new Date(dashboardSessionStartedMs - 60_000).toISOString(),
      }),
    );
    const now = Date.now() / 1000;
    utimesSync(artifact, now, now);

    expect(isSwarmSessionActiveForTenant(TENANT)).toBe(true);
    expect(isSwarmArtifactVisibleForSession(artifact, TENANT)).toBe(true);
  });

  it('exposes artifacts when job started in current session', () => {
    const startedAt = new Date().toISOString();
    writeFileSync(
      join(TENANT_DIR, 'job.json'),
      JSON.stringify({ jobId: 'live', state: 'done', startedAt }),
    );
    const artifact = join(TENANT_DIR, 'latest.json');
    writeFileSync(artifact, '{"overall":true}');

    expect(getSessionJobStartedMs(TENANT)).not.toBeNull();
    expect(isSwarmSessionActiveForTenant(TENANT)).toBe(true);
    expect(isSwarmArtifactVisibleForSession(artifact, TENANT)).toBe(true);
  });
});
