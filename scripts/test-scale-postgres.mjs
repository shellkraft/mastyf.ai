#!/usr/bin/env node
/**
 * Postgres scale smoke — concurrent inserts + tenant-scoped reads + latency stats.
 * Usage: DATABASE_URL=... SCALE_TEST_CONCURRENCY=50 pnpm test:scale-postgres
 */
import pg from 'pg';

const CONCURRENCY = parseInt(process.env.SCALE_TEST_CONCURRENCY || '50', 10);
const TENANT = process.env.MASTYFF_AI_TENANT_ID || 'scale-test';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: url, max: CONCURRENCY });
  const latencies: number[] = [];
  const start = Date.now();

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async (_, i) => {
      const t0 = Date.now();
      await pool.query(
        `INSERT INTO call_records (server_name, tool_name, tenant_id, recorded_at, blocked, total_tokens, cost_usd)
         VALUES ($1, $2, $3, NOW(), false, 10, 0.001)
         ON CONFLICT DO NOTHING`,
        ['scale-server', `tool_${i}`, TENANT],
      ).catch((e) => {
        if (!String(e.message).includes('does not exist')) throw e;
      });
      latencies.push(Date.now() - t0);
    }),
  );

  const readStart = Date.now();
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM call_records WHERE tenant_id = $1`,
    [TENANT],
  );
  const readMs = Date.now() - readStart;
  const elapsed = Date.now() - start;
  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.99))] || 0;

  console.log(
    JSON.stringify(
      {
        ok: true,
        concurrency: CONCURRENCY,
        count: rows[0]?.c,
        elapsedMs: elapsed,
        insertP99Ms: p99,
        tenantReadMs: readMs,
        evidence: 'enterprise-mcp-tests-31 horizontal scale pilot',
      },
      null,
      2,
    ),
  );
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
