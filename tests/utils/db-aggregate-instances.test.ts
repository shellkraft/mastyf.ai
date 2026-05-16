import { describe, it, expect } from 'vitest';
import { aggregateInstancesByServer } from '../../src/utils/db-aggregate.js';
import type { ProxyCallRecord } from '../../src/types.js';

function rec(serverName: string, blocked = false, ts = '2026-05-16T12:00:00Z'): ProxyCallRecord {
  return {
    serverName,
    toolName: 'search',
    blocked,
    timestamp: ts,
    durationMs: 10,
    requestTokens: 1,
    responseTokens: 1,
    totalTokens: 2,
  } as ProxyCallRecord;
}

describe('aggregateInstancesByServer', () => {
  it('returns one row per server with request counts', () => {
    const now = new Date('2026-05-16T12:01:00Z').getTime();
    const rows = aggregateInstancesByServer(
      [rec('github'), rec('github', true), rec('filesystem')],
      ['github', 'filesystem', 'postgres'],
      now,
    );
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ instanceName: 'github', totalRequests: 2, blockedRequests: 1, status: 'active' });
    expect(rows[1]).toMatchObject({ instanceName: 'filesystem', totalRequests: 1, status: 'active' });
    expect(rows[2]).toMatchObject({ instanceName: 'postgres', totalRequests: 0, status: 'offline' });
  });
});
