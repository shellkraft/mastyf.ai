import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveDpopRedisUrl, isDpopRedisConfigured } from '../../src/auth/dpop-nonce-store.js';

describe('MASTYFF_AI_DPOP_REDIS_URL', () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.MASTYFF_AI_DPOP_REDIS_URL;
    delete process.env.REDIS_URL;
    delete process.env.REDIS_SENTINELS;
    delete process.env.REDIS_CLUSTER_NODES;
  });

  afterEach(() => {
    process.env = env;
  });

  it('prefers MASTYFF_AI_DPOP_REDIS_URL over REDIS_URL', () => {
    process.env.MASTYFF_AI_DPOP_REDIS_URL = 'redis://global:6379';
    process.env.REDIS_URL = 'redis://local:6379';
    expect(resolveDpopRedisUrl()).toBe('redis://global:6379');
    expect(isDpopRedisConfigured()).toBe(true);
  });

  it('falls back to REDIS_URL when cross-region URL unset', () => {
    process.env.REDIS_URL = 'redis://local:6379';
    expect(resolveDpopRedisUrl()).toBe('redis://local:6379');
  });

  it('returns null when no Redis configured', () => {
    expect(resolveDpopRedisUrl()).toBeNull();
    expect(isDpopRedisConfigured()).toBe(false);
  });
});
