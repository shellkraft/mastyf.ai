/**
 * Postgres row-level security session helper (§6.1 Issue #4).
 * Requires migration 006/008 and MASTYFF_AI_PG_RLS_ENABLED=true.
 */
import type { PgPoolType } from './pg-loader.js';

export function isPostgresRlsEnabled(): boolean {
  return process.env['MASTYFF_AI_PG_RLS_ENABLED'] === 'true';
}

export async function withPostgresTenantSession<T>(
  pool: PgPoolType,
  tenantId: string,
  fn: (client: {
    query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
  }) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query(`SET LOCAL app.tenant_id = $1`, [tenantId]);
    return await fn(client);
  } finally {
    client.release();
  }
}
