import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getFleetStatus } from '../../src/fleet/fleet-aggregator.js';
import { HistoryDatabase } from '../../src/database/history-db.js';

describe('fleet status', () => {
  let dir: string;
  const prevPaths = process.env.MASTYFF_AI_FLEET_DB_PATHS;
  const prevDb = process.env.MASTYFF_AI_DB_PATH;
  const prevType = process.env.DB_TYPE;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    if (prevPaths === undefined) delete process.env.MASTYFF_AI_FLEET_DB_PATHS;
    else process.env.MASTYFF_AI_FLEET_DB_PATHS = prevPaths;
    if (prevDb === undefined) delete process.env.MASTYFF_AI_DB_PATH;
    else process.env.MASTYFF_AI_DB_PATH = prevDb;
    if (prevType === undefined) delete process.env.DB_TYPE;
    else process.env.DB_TYPE = prevType;
  });

  it('aggregates a single sqlite fleet db path', async () => {
    dir = mkdtempSync(join(tmpdir(), 'mastyff-ai-fleet-'));
    const dbPath = join(dir, 'a.db');
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

    const report = await getFleetStatus();
    expect(report.source).toBe('sqlite');
    expect(report.totalInstances).toBeGreaterThanOrEqual(1);
    expect(report.totalRequests).toBeGreaterThanOrEqual(1);
  });
});
