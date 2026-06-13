import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { buildDashboardFleetResponse } from '../../src/utils/dashboard-fleet-api.js';
import { HistoryDatabase } from '../../src/database/history-db.js';

describe('buildDashboardFleetResponse', () => {
  let dir: string;
  const prevPaths = process.env.MASTYFF_AI_FLEET_DB_PATHS;
  const prevType = process.env.DB_TYPE;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    if (prevPaths === undefined) delete process.env.MASTYFF_AI_FLEET_DB_PATHS;
    else process.env.MASTYFF_AI_FLEET_DB_PATHS = prevPaths;
    if (prevType === undefined) delete process.env.DB_TYPE;
    else process.env.DB_TYPE = prevType;
  });

  it('returns fleet instances from MASTYFF_AI_FLEET_DB_PATHS', async () => {
    dir = mkdtempSync(join(tmpdir(), 'mastyff-ai-fleet-api-'));
    const dbPath = join(dir, 'replica-a.db');
    delete process.env.DB_TYPE;
    process.env.MASTYFF_AI_FLEET_DB_PATHS = dbPath;

    const db = new HistoryDatabase(dbPath);
    await db.initialize();
    await db.addCallRecord({
      serverName: 'github',
      toolName: 'search',
      requestTokens: 1,
      responseTokens: 1,
      totalTokens: 2,
      durationMs: 5,
      blocked: false,
      timestamp: new Date().toISOString(),
    });
    await db.close();

    const res = await buildDashboardFleetResponse(null, 'default');
    expect(res.available).toBe(true);
    expect(res.instances.length).toBeGreaterThanOrEqual(1);
    expect(res.instances[0]?.fleetSource).toBe('sqlite');
    expect(res.totalRequests).toBeGreaterThanOrEqual(1);
  });

  it('falls back to local instance when fleet paths empty', async () => {
    delete process.env.MASTYFF_AI_FLEET_DB_PATHS;
    delete process.env.DB_TYPE;

    dir = mkdtempSync(join(tmpdir(), 'mastyff-ai-fleet-local-'));
    const dbPath = join(dir, 'local.db');
    const db = new HistoryDatabase(dbPath);
    await db.initialize();
    await db.addCallRecord({
      serverName: 'fs',
      toolName: 'read',
      requestTokens: 1,
      responseTokens: 1,
      totalTokens: 2,
      durationMs: 3,
      blocked: true,
      timestamp: new Date().toISOString(),
    });

    const res = await buildDashboardFleetResponse(db, 'default');
    expect(res.source).toBe('local');
    expect(res.instances).toHaveLength(1);
    expect(res.instances[0]?.totalRequests).toBe(1);
    expect(res.instances[0]?.blockedRequests).toBe(1);
    await db.close();
  });

  it('aligns with sqlite-fleet federated mode when multiple paths set', async () => {
    const { resolveFederatedMode } = await import('../../src/utils/federated-data-source.js');
    dir = mkdtempSync(join(tmpdir(), 'mastyff-ai-fleet-fed-'));
    const a = join(dir, 'a.db');
    const b = join(dir, 'b.db');
    delete process.env.DB_TYPE;
    delete process.env.DATABASE_URL;
    process.env.MASTYFF_AI_FLEET_DB_PATHS = `${a},${b}`;
    expect(resolveFederatedMode(null)).toBe('sqlite-fleet');
  });
});
