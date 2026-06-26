import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';

const { execute } = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getDb: () => ({ execute }),
}));

vi.mock('@/lib/cloud-observatory-store', () => ({
  observatorySnapshot: () => ({}),
}));

import { buildPerformanceReport } from '../lib/performance-report';

function emptyQueryResult() {
  return [];
}

describe('buildPerformanceReport org scoping', () => {
  beforeEach(() => {
    execute.mockReset();
    execute.mockImplementation(async () => emptyQueryResult());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects malicious orgId before any database query', async () => {
    await expect(
      buildPerformanceReport({ windowDays: 7, orgId: "'; DROP TABLE organizations; --" }),
    ).rejects.toThrow(/invalid_org_id/);
    expect(execute).not.toHaveBeenCalled();
  });

  it('passes scoped orgId as a bound parameter in fleet query', async () => {
    const orgId = '550e8400-e29b-41d4-a716-446655440000';
    let callIndex = 0;
    execute.mockImplementation(async (query: unknown) => {
      callIndex++;
      if (callIndex === 1) {
        return [{ org_count: 0, user_count: 0, active_keys: 0, cert_count: 0 }];
      }
      if (callIndex === 2 || callIndex === 3) return [{ cnt: 0 }];
      if (callIndex === 4 || callIndex === 5) return [];
      if (callIndex === 6) return [];
      const text = sqlText(query);
      if (text.includes('mastyf_ai_fleet_instances') && text.includes('org_id')) {
        return [];
      }
      return [];
    });

    await buildPerformanceReport({ windowDays: 7, orgId });

    const fleetCall = execute.mock.calls.find(([query]) => {
      const text = sqlText(query);
      return text.includes('mastyf_ai_fleet_instances') && text.includes('org_id');
    });
    expect(fleetCall).toBeDefined();
    const fleetSql = sqlText(fleetCall![0]);
    expect(fleetSql).toContain('mastyf_ai_fleet_instances');
    expect(fleetSql).toContain('org_id');
    expect(sqlParams(fleetCall![0])).toContain(orgId);
    expect(fleetSql).not.toMatch(/DROP TABLE/i);
  });
});

function sqlParams(query: unknown): unknown[] {
  const q = query as { queryChunks?: unknown[] };
  if (!Array.isArray(q?.queryChunks)) return [];
  return q.queryChunks.filter((chunk) => typeof chunk === 'string' || typeof chunk === 'number');
}

function sqlText(query: unknown): string {
  const q = query as { queryChunks?: Array<{ value?: string[] | string }> };
  if (!q?.queryChunks) return String(query);
  return q.queryChunks
    .map((chunk) => (Array.isArray(chunk.value) ? chunk.value.join('') : String(chunk.value ?? '')))
    .join('');
}
