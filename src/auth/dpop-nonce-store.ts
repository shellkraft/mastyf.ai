import { Redis } from 'ioredis';
import { Logger } from '../utils/logger.js';

/** Pluggable DPoP jti replay store (in-memory single instance or Redis HA). */
export interface DPoPNonceStore {
  /** Returns true if this jti is the first use; false if replay. */
  claim(jti: string): Promise<boolean>;
  cleanupExpired?(): void;
}

export class InMemoryDPoPNonceStore implements DPoPNonceStore {
  private used = new Map<string, number>();
  private lastCleanup = Date.now();

  constructor(private readonly ttlMs: number) {}

  cleanupExpired(): void {
    const now = Date.now();
    if (now - this.lastCleanup < 60_000) return;
    const expiry = now - this.ttlMs;
    for (const [jti, ts] of this.used) {
      if (ts < expiry) this.used.delete(jti);
    }
    this.lastCleanup = now;
  }

  async claim(jti: string): Promise<boolean> {
    this.cleanupExpired();
    if (this.used.has(jti)) return false;
    this.used.set(jti, Date.now());
    return true;
  }
}

export class RedisDPoPNonceStore implements DPoPNonceStore {
  private redis: Redis;
  private readonly prefix = 'mcp_guardian:dpop:jti:';

  constructor(
    private readonly ttlSeconds: number,
    redisUrl?: string,
  ) {
    const url = redisUrl || process.env['REDIS_URL'] || 'redis://localhost:6379';
    this.redis = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: false });
    Logger.info(`[dpop] Redis nonce store: ${url}`);
  }

  async claim(jti: string): Promise<boolean> {
    const ok = await this.redis.set(`${this.prefix}${jti}`, '1', 'EX', this.ttlSeconds, 'NX');
    return ok === 'OK';
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}

export function createDPoPNonceStore(ttlMs: number): DPoPNonceStore {
  if (process.env['REDIS_URL']) {
    return new RedisDPoPNonceStore(Math.ceil(ttlMs / 1000));
  }
  return new InMemoryDPoPNonceStore(ttlMs);
}
