import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/utils/redis-client.js', () => ({
  createRedisClient: vi.fn(() => ({
    incr: vi.fn().mockResolvedValue(1),
    pexpire: vi.fn().mockResolvedValue(1),
    set: vi.fn().mockResolvedValue('OK'),
    quit: vi.fn().mockResolvedValue('OK'),
  })),
  getRedisConnectionLabel: () => 'mock',
  isRedisConfigured: () => true,
}));

describe('RedisRateLimiter region isolation', () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env = { ...env };
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  });

  afterEach(async () => {
    const { resetRedisRateLimiterForTests } = await import('../../src/utils/redis-rate-limiter.js');
    resetRedisRateLimiterForTests();
    process.env = env;
  });

  it('uses MASTYFF_AI_REGION in limiter scope', async () => {
    process.env.MASTYFF_AI_REGION = 'us-east-1';
    const { RedisRateLimiter } = await import('../../src/utils/redis-rate-limiter.js');
    const limiter = new RedisRateLimiter();
    expect(limiter.getRegion()).toBe('us-east-1');
  });

  it('changes region label when MASTYFF_AI_REGION changes', async () => {
    process.env.MASTYFF_AI_REGION = 'eu-west-1';
    const { RedisRateLimiter } = await import('../../src/utils/redis-rate-limiter.js');
    const limiter = new RedisRateLimiter();
    expect(limiter.getRegion()).toBe('eu-west-1');
  });
});
