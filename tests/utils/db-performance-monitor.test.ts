import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { monitorDbQuery, getSlowQueryThresholdMs } from '../../src/utils/db-performance-monitor.js';

describe('db-performance-monitor', () => {
  const prev = process.env.MASTYFF_AI_DB_SLOW_QUERY_MS;

  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.MASTYFF_AI_DB_SLOW_QUERY_MS;
    else process.env.MASTYFF_AI_DB_SLOW_QUERY_MS = prev;
    vi.restoreAllMocks();
  });

  it('default threshold is 100ms', () => {
    delete process.env.MASTYFF_AI_DB_SLOW_QUERY_MS;
    expect(getSlowQueryThresholdMs()).toBe(100);
  });

  it('returns query result', () => {
    const out = monitorDbQuery('test', () => 42);
    expect(out).toBe(42);
  });
});
