import { describe, it, expect } from 'vitest';
import { HistoryDatabase } from '../../src/database/history-db.js';

describe('HistoryDatabase.transaction', () => {
  it('commits synchronous callbacks', async () => {
    const db = new HistoryDatabase(':memory:');
    await db.initialize();
    const result = await db.transaction(() => 42);
    expect(result).toBe(42);
    db.close();
  });

  it('rejects async callbacks with a clear error', async () => {
    const db = new HistoryDatabase(':memory:');
    await db.initialize();
    await expect(
      db.transaction(async () => 1),
    ).rejects.toThrow(/Async callbacks not supported/);
    db.close();
  });

  it('transactionSync runs synchronous callback', async () => {
    const db = new HistoryDatabase(':memory:');
    await db.initialize();
    const n = await db.transactionSync(() => 99);
    expect(n).toBe(99);
    db.close();
  });
});
