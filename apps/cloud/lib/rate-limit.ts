import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { NextRequest } from 'next/server';

export type RateLimitResult =
  | { success: true }
  | { success: false; retryAfter: number };

let badgeLimiter: Ratelimit | null | undefined;
let deepScanLimiter: Ratelimit | null | undefined;
let rateLimitUnavailableLogged = false;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function isRateLimitRequired(): boolean {
  return process.env.MASTYF_AI_RATE_LIMIT_REQUIRED === 'true';
}

function getBadgeLimit(): number {
  const raw = process.env.MASTYF_AI_CLOUD_BADGE_RATE_LIMIT;
  const n = raw ? parseInt(raw, 10) : 100;
  return Number.isFinite(n) && n > 0 ? n : 100;
}

function getDeepScanLimit(): number {
  const raw = process.env.MASTYF_AI_CLOUD_DEEP_SCAN_RATE_LIMIT;
  const n = raw ? parseInt(raw, 10) : 10;
  return Number.isFinite(n) && n > 0 ? n : 10;
}

function getBadgeLimiter(): Ratelimit | null {
  if (badgeLimiter !== undefined) return badgeLimiter;
  const redis = getRedis();
  if (!redis) {
    badgeLimiter = null;
    return null;
  }
  badgeLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(getBadgeLimit(), '1 h'),
    prefix: 'mastyf-ai:cloud:badge',
  });
  return badgeLimiter;
}

function getDeepScanLimiter(): Ratelimit | null {
  if (deepScanLimiter !== undefined) return deepScanLimiter;
  const redis = getRedis();
  if (!redis) {
    deepScanLimiter = null;
    return null;
  }
  deepScanLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(getDeepScanLimit(), '1 m'),
    prefix: 'mastyf-ai:cloud:deep-scan',
  });
  return deepScanLimiter;
}

export function clientIpFromRequest(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

export async function checkPublicApiRateLimit(
  request: NextRequest,
  pathname: string,
): Promise<RateLimitResult> {
  const limiter = pathname.startsWith('/api/v1/deep-scan/')
    ? getDeepScanLimiter()
    : getBadgeLimiter();

  if (!limiter) {
    if (isRateLimitRequired()) {
      if (!rateLimitUnavailableLogged) {
        rateLimitUnavailableLogged = true;
        console.error(
          '[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN unset but rate limiting is required in production',
        );
      }
      return { success: false, retryAfter: 60 };
    }
    return { success: true };
  }

  const ip = clientIpFromRequest(request);
  const scope = pathname.startsWith('/api/v1/deep-scan/') ? 'deep-scan' : 'badge';
  const { success, reset } = await limiter.limit(`${scope}:${ip}`);
  if (success) return { success: true };

  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return { success: false, retryAfter };
}

/** @internal test helper */
export function resetRateLimitClientsForTests(): void {
  badgeLimiter = undefined;
  deepScanLimiter = undefined;
  rateLimitUnavailableLogged = false;
}
