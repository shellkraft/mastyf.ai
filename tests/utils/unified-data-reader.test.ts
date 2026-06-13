import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveFederatedMode } from '../../src/utils/federated-data-source.js';

describe('federated-data-source', () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.DATABASE_URL;
    delete process.env.MASTYFF_AI_DASHBOARD_DATA_SOURCE;
    delete process.env.MASTYFF_AI_AUDIT_SYNC_ENABLED;
    delete process.env.MASTYFF_AI_FLEET_DB_PATHS;
    delete process.env.DB_TYPE;
  });

  it('selects unified when DATABASE_URL and audit sync enabled (auto)', () => {
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    process.env.MASTYFF_AI_AUDIT_SYNC_ENABLED = 'true';
    expect(resolveFederatedMode(null)).toBe('unified');
  });

  it('selects local when pref=local', () => {
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    process.env.MASTYFF_AI_DASHBOARD_DATA_SOURCE = 'local';
    expect(resolveFederatedMode(null)).toBe('local');
  });

  it('selects sqlite-fleet when multiple fleet paths', () => {
    process.env.MASTYFF_AI_FLEET_DB_PATHS = '/a/history.db,/b/history.db';
    expect(resolveFederatedMode(null)).toBe('sqlite-fleet');
  });

  it('selects postgres-direct when DB_TYPE=postgres', () => {
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    process.env.DB_TYPE = 'postgres';
    expect(resolveFederatedMode(null)).toBe('postgres-direct');
  });
});

describe('UnifiedDataReader row mapping', () => {
  it('maps block action and cost from audit row', async () => {
    const { UnifiedDataReader } = await import('../../src/utils/unified-data-reader.js');
    const fakePool = {
      connect: async () => ({
        query: async () => ({
          rows: [{
            server_name: 'srv',
            tool_name: 'tool',
            action: 'block',
            rule_name: 'secret-scan',
            reason: 'blocked',
            request_tokens: 1,
            response_tokens: 2,
            total_tokens: 3,
            duration_ms: 10,
            estimated_cost_usd: 0.01,
            timestamp: '2026-01-01T00:00:00.000Z',
            tenant_id: 'default',
          }],
        }),
        release: () => {},
      }),
    };
    const reader = new UnifiedDataReader(fakePool as any);
    const records = await reader.loadCallRecordsInWindow('default', 7);
    expect(records[0]?.blocked).toBe(true);
    expect(records[0]?.blockRule).toBe('secret-scan');
    expect(records[0]?.costUsd).toBe(0.01);
  });
});
