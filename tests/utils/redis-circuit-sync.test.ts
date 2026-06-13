import { describe, it, expect, vi, afterEach } from 'vitest';
import * as Metrics from '../../src/utils/metrics.js';

describe('redis-circuit-sync metrics', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('increments circuit_breaker_sync_total on load when redis not configured', async () => {
    vi.stubEnv('REDIS_URL', '');
    const { loadCircuitFromRedis, resetCircuitRedisSyncForTests } = await import(
      '../../src/utils/redis-circuit-sync.js'
    );
    resetCircuitRedisSyncForTests();
    const before = await Metrics.registry.getSingleMetricAsString(
      'mastyff_ai_circuit_breaker_sync_total',
    );
    await loadCircuitFromRedis('tenant:server');
    const after = await Metrics.registry.getSingleMetricAsString(
      'mastyff_ai_circuit_breaker_sync_total',
    );
    expect(after).toBeDefined();
    expect(before ?? '').toBe(after ?? '');
  });
});
