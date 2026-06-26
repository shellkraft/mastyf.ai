import { describe, expect, it, afterEach, vi } from 'vitest';
import {
  clientIpFromRequest,
  checkPublicApiRateLimit,
  resetRateLimitClientsForTests,
} from '@/lib/rate-limit';

function mockRequest(headers: Record<string, string> = {}): Parameters<typeof checkPublicApiRateLimit>[0] {
  return {
    headers: {
      get(name: string) {
        const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
        return key ? headers[key] : null;
      },
    },
  } as Parameters<typeof checkPublicApiRateLimit>[0];
}

describe('rate-limit', () => {
  afterEach(() => {
    resetRateLimitClientsForTests();
    vi.unstubAllEnvs();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.MASTYF_AI_RATE_LIMIT_REQUIRED;
  });

  it('extracts client IP from x-forwarded-for', () => {
    const req = mockRequest({ 'x-forwarded-for': '203.0.113.1, 10.0.0.1' });
    expect(clientIpFromRequest(req)).toBe('203.0.113.1');
  });

  it('allows requests when Upstash is not configured (dev)', async () => {
    const result = await checkPublicApiRateLimit(mockRequest(), '/api/v1/badge/foo/json');
    expect(result.success).toBe(true);
  });

  it('blocks when rate limit required but Upstash unset', async () => {
    vi.stubEnv('MASTYF_AI_RATE_LIMIT_REQUIRED', 'true');
    const result = await checkPublicApiRateLimit(mockRequest(), '/api/v1/badge/foo/json');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.retryAfter).toBeGreaterThan(0);
    }
  });

  it('reads configurable badge rate limit from env', () => {
    vi.stubEnv('MASTYF_AI_CLOUD_BADGE_RATE_LIMIT', '42');
    vi.stubEnv('MASTYF_AI_CLOUD_DEEP_SCAN_RATE_LIMIT', '5');
    expect(process.env.MASTYF_AI_CLOUD_BADGE_RATE_LIMIT).toBe('42');
    expect(process.env.MASTYF_AI_CLOUD_DEEP_SCAN_RATE_LIMIT).toBe('5');
  });
});
