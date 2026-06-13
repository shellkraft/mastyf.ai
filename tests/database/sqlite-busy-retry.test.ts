import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { HistoryDatabase } from '../../src/database/history-db.js';
import { withSqliteBusyRetry, isSqliteBusyError } from '../../src/utils/sqlite-busy-retry.js';

describe('sqlite busy retry', () => {
  it('detects SQLITE_BUSY errors', () => {
    expect(isSqliteBusyError({ code: 'SQLITE_BUSY' })).toBe(true);
    expect(isSqliteBusyError(new Error('other'))).toBe(false);
  });

  it('retries failed writes', async () => {
    let attempts = 0;
    await withSqliteBusyRetry(async () => {
      attempts++;
      if (attempts < 2) {
        const err = new Error('busy') as Error & { code: string };
        err.code = 'SQLITE_BUSY';
        throw err;
      }
    });
    expect(attempts).toBe(2);
  });

  it('supports concurrent writers on shared WAL database', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mastyff-ai-busy-'));
    const dbPath = join(dir, 'history.db');
    const primary = new HistoryDatabase(dbPath);
    const secondary = new HistoryDatabase(dbPath);

    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        withSqliteBusyRetry(() =>
          (i % 2 === 0 ? primary : secondary).addCallRecord({
            serverName: 'test',
            toolName: `tool-${i}`,
            requestTokens: 1,
            responseTokens: 1,
            totalTokens: 2,
            durationMs: 1,
          }),
        ),
      ),
    );

    const rows = await primary.getCallRecordsForServer('test', 20);
    expect(rows.length).toBeGreaterThanOrEqual(12);
    primary.close();
    secondary.close();
  });
});
