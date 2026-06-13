import { describe, it, expect } from 'vitest';
import { isPostgresRlsEnabled } from '../../src/database/postgres-tenant-session.js';

const LIVE_PG = process.env.DATABASE_URL?.startsWith('postgres');

describe('Postgres RLS session', () => {
  it('is disabled unless MASTYFF_AI_PG_RLS_ENABLED=true', () => {
    const prev = process.env.MASTYFF_AI_PG_RLS_ENABLED;
    delete process.env.MASTYFF_AI_PG_RLS_ENABLED;
    expect(isPostgresRlsEnabled()).toBe(false);
    process.env.MASTYFF_AI_PG_RLS_ENABLED = 'true';
    expect(isPostgresRlsEnabled()).toBe(true);
    if (prev !== undefined) process.env.MASTYFF_AI_PG_RLS_ENABLED = prev;
    else delete process.env.MASTYFF_AI_PG_RLS_ENABLED;
  });

  it.skipIf(!LIVE_PG)('sets app.tenant_id per session', async () => {
    const { default: pg } = await import('pg');
    const { withPostgresTenantSession } = await import('../../src/database/postgres-tenant-session.js');
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    try {
      const tid = await withPostgresTenantSession(pool, 'rls-test-tenant', async (client) => {
        const r = await client.query(`SELECT current_setting('app.tenant_id', true) AS tid`);
        return String((r.rows[0] as { tid?: string })?.tid ?? '');
      });
      expect(tid).toBe('rls-test-tenant');
    } finally {
      await pool.end();
    }
  });
});
