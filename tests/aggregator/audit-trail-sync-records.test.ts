import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryDatabase } from '../../src/database/history-db.js';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('AuditTrailSync call record mapping', () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mastyff-ai-sync-'));
    dbPath = join(dir, 'history.db');
  });

  it('getCallRecordsAfterId returns sourceId and blocked fields', async () => {
    const db = new HistoryDatabase(dbPath);
    await db.initialize();
    await db.addCallRecord({
      serverName: 'demo',
      toolName: 'run',
      requestTokens: 10,
      responseTokens: 5,
      totalTokens: 15,
      durationMs: 20,
      timestamp: new Date().toISOString(),
      blocked: true,
      blockRule: 'path-guard',
      blockReason: 'denied',
      costUsd: 0.002,
      tenantId: 'default',
    });
    const rows = await db.getCallRecordsAfterId('demo', 0, 10, 'default');
    expect(rows.length).toBe(1);
    expect(rows[0]?.sourceId).toBeGreaterThan(0);
    expect(rows[0]?.blocked).toBe(true);
    expect(rows[0]?.blockRule).toBe('path-guard');
    expect(rows[0]?.costUsd).toBe(0.002);
    await db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
