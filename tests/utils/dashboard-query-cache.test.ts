import { describe, it, expect, beforeEach } from 'vitest';
import {
  cachedDashboardQuery,
  dashboardQueryCacheKey,
  resetDashboardQueryCacheForTests,
} from '../../src/utils/dashboard-query-cache.js';

describe('dashboard-query-cache', () => {
  beforeEach(() => {
    resetDashboardQueryCacheForTests();
    delete process.env.MASTYFF_AI_DASHBOARD_QUERY_CACHE;
  });

  it('caches loader results in-process when enabled', async () => {
    process.env.MASTYFF_AI_DASHBOARD_QUERY_CACHE = 'true';
    let runs = 0;
    const key = dashboardQueryCacheKey({ route: 'test', tenant: 't1' });
    const loader = async () => {
      runs++;
      return { ok: true };
    };
    await cachedDashboardQuery(key, loader);
    await cachedDashboardQuery(key, loader);
    expect(runs).toBe(1);
  });
});
