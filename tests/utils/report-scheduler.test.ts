import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { readLatestDigestArtifacts, generateDigest } from '../../src/utils/report-scheduler.js';
import { writeLastDigestMeta } from '../../src/utils/autopilot-config.js';
import { resolveTenantSwarmDir } from '../../src/tenant/swarm-tenant-paths.js';

const TENANT = 'test-report-scheduler';

describe('report-scheduler', () => {
  const tenantDir = resolveTenantSwarmDir(TENANT);
  const digestMetaPath = join(tenantDir, 'last-digest-test.json');

  beforeEach(() => {
    mkdirSync(tenantDir, { recursive: true });
    process.env.MASTYFF_AI_REPORT_SCHEDULE = 'off';
    process.env.MASTYFF_AI_LAST_DIGEST_PATH = digestMetaPath;
  });

  afterEach(() => {
    const root = join(process.cwd(), 'reports', 'tenants', TENANT);
    if (existsSync(root)) rmSync(root, { recursive: true, force: true });
    delete process.env.MASTYFF_AI_LAST_DIGEST_PATH;
  });

  it('generateDigest returns error without db', async () => {
    const result = await generateDigest(null, TENANT);
    expect(result.error).toBe('No history database');
  });

  it('readLatestDigestArtifacts returns empty when no meta for tenant', () => {
    const d = readLatestDigestArtifacts(TENANT);
    expect(d.healthMarkdown).toBeUndefined();
    expect(d.securityJson).toBeUndefined();
    expect(d.generatedAt).toBeUndefined();
  });

  it('readLatestDigestArtifacts ignores digest meta for other tenants', () => {
    writeLastDigestMeta({
      generatedAt: new Date().toISOString(),
      tenantId: 'default',
      healthPath: join(tenantDir, 'digests', 'health-2099-01-01.md'),
    });
    const d = readLatestDigestArtifacts(TENANT);
    expect(d.healthMarkdown).toBeUndefined();
  });
});
