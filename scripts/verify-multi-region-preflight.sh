#!/usr/bin/env sh
# Multi-region preflight — Redis RTT, PG connectivity, region labels.
set -eu

REGION="${MASTYFF_AI_REGION:-us-east-1}"
echo "[multi-region] region=${REGION}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "WARN: DATABASE_URL not set — skip PG check"
else
  node -e "
    import('pg').then(async ({ default: pg }) => {
      const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
      await pool.query('SELECT 1');
      await pool.end();
      console.log('OK: PostgreSQL reachable');
    }).catch((e) => { console.error('FAIL: PostgreSQL', e.message); process.exit(1); });
  "
fi

if [ -n "${REDIS_URL:-}" ]; then
  node -e "
    import('ioredis').then(async ({ default: Redis }) => {
      const r = new Redis(process.env.REDIS_URL, { connectTimeout: 3000, maxRetriesPerRequest: 1 });
      const t0 = Date.now();
      await r.ping();
      const rtt = Date.now() - t0;
      await r.quit();
      console.log('OK: Redis RTT=' + rtt + 'ms');
      if (rtt > 80 && [process.env.MASTYFF_AI_MULTI_REGION_MODE].includes('active-active')) {
        console.warn('WARN: Redis RTT > 80ms — cross-region global cap may be best-effort');
      }
    }).catch((e) => { console.error('FAIL: Redis', e.message); process.exit(1); });
  "
else
  echo "WARN: REDIS_URL not set — skip Redis RTT"
fi

if [ -z "${MASTYFF_AI_REGION:-}" ]; then
  echo "WARN: MASTYFF_AI_REGION not set — fleet/charts may not group by region"
fi

echo "[multi-region] preflight complete"
