import { createHash } from 'crypto';
import { LRUCache } from 'lru-cache';
import type { Redis, Cluster } from 'ioredis';
import { createRedisClient, getRedisConnectionLabel, isRedisConfigured } from '../utils/redis-client.js';
import { Counter } from 'prom-client';
import { Logger } from '../utils/logger.js';
import { registry } from '../utils/metrics.js';
import { getMastyffAiRegion } from '../utils/region.js';

export interface LlmCacheKeyInput {
  model: string;
  prompt: string;
  system: string;
  temperature: number;
}

/** Semantic audit cache input — keyed by normalized tool-call fingerprint, not full prompt text. */
export interface SemanticLlmCacheKeyInput {
  model: string;
  serverName: string;
  toolName: string;
  arguments?: Record<string, unknown>;
  temperature: number;
  tenantId?: string;
  policyMode?: string;
}

const cacheHits = new Counter({
  name: 'mastyff_ai_llm_cache_hits_total',
  help: 'LLM response cache hits',
  labelNames: ['backend'],
  registers: [registry],
});

const cacheMisses = new Counter({
  name: 'mastyff_ai_llm_cache_misses_total',
  help: 'LLM response cache misses',
  labelNames: ['backend'],
  registers: [registry],
});

let sharedCache: LlmCache | null = null;

export function isLlmCacheEnabled(): boolean {
  if (process.env.MASTYFF_AI_LLM_CACHE === 'false') return false;
  if (process.env.MASTYFF_AI_LLM_CACHE === 'true') return true;
  return isRedisConfigured();
}

export function getLlmCache(): LlmCache {
  if (!sharedCache) {
    sharedCache = new LlmCache();
  }
  return sharedCache;
}

export function resetLlmCacheForTests(): void {
  if (sharedCache) {
    void sharedCache.close();
  }
  sharedCache = null;
}

function hashCacheKey(input: LlmCacheKeyInput): string {
  const payload = `${input.model}\0${input.system}\0${input.prompt}\0${input.temperature}`;
  return createHash('sha256').update(payload).digest('hex');
}

function normalizeArgLeaves(args?: Record<string, unknown>): string {
  if (!args || typeof args !== 'object') return '';
  const parts: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === 'string') parts.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(args);
  return parts.join('\n').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function hashSemanticAuditKey(input: SemanticLlmCacheKeyInput): string {
  const argNorm = normalizeArgLeaves(input.arguments);
  const tenant = input.tenantId?.trim() || 'default';
  const mode = input.policyMode?.trim() || 'block';
  const payload = `${tenant}\0${mode}\0${input.model}\0${input.serverName}\0${input.toolName}\0${argNorm}\0${input.temperature}`;
  return createHash('sha256').update(payload).digest('hex');
}

export function semanticToLlmCacheKey(
  input: SemanticLlmCacheKeyInput,
  system: string,
  userPrompt: string,
): LlmCacheKeyInput {
  const fp = hashSemanticAuditKey(input);
  return {
    model: input.model,
    system,
    prompt: `semantic-fp:${fp}\n${userPrompt}`,
    temperature: input.temperature,
  };
}

function ttlSec(): number {
  const parsed = parseInt(process.env.MASTYFF_AI_LLM_CACHE_TTL_SEC || '86400', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 86400;
}

const LRU_MAX = 500;

export class LlmCache {
  private readonly enabled: boolean;
  private readonly ttlMs: number;
  private readonly region: string;
  private readonly redisPrefix: string;
  private redis: Redis | Cluster | null = null;
  private readonly lru: LRUCache<string, string>;

  constructor() {
    this.enabled = isLlmCacheEnabled();
    this.ttlMs = ttlSec() * 1000;
    this.region = getMastyffAiRegion();
    this.redisPrefix = `mastyff_ai:llm_cache:${this.region}:`;
    this.lru = new LRUCache<string, string>({
      max: LRU_MAX,
      ttl: this.ttlMs,
      updateAgeOnGet: false,
    });

    if (this.enabled && isRedisConfigured()) {
      this.redis = createRedisClient({ maxRetriesPerRequest: 2, lazyConnect: false });
      Logger.info(`[llm-cache] Redis backend ${getRedisConnectionLabel()} (region=${this.region}, ttl=${ttlSec()}s)`);
    } else if (this.enabled) {
      Logger.info('[llm-cache] In-memory LRU backend (Redis not configured)');
    }
  }

  private storageKey(input: LlmCacheKeyInput): string {
    return hashCacheKey(input);
  }

  private redisKey(hash: string): string {
    return `${this.redisPrefix}${hash}`;
  }

  async get(input: LlmCacheKeyInput): Promise<string | null> {
    if (!this.enabled) return null;

    const hash = this.storageKey(input);

    if (this.redis) {
      try {
        const value = await this.redis.get(this.redisKey(hash));
        if (value != null) {
          this.lru.set(hash, value);
          cacheHits.inc({ backend: 'redis' });
          return value;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        Logger.debug(`[llm-cache] Redis get failed: ${msg}`);
      }
    }

    const local = this.lru.get(hash);
    if (local != null) {
      cacheHits.inc({ backend: 'lru' });
      return local;
    }

    cacheMisses.inc({ backend: this.redis ? 'redis' : 'lru' });
    return null;
  }

  async set(input: LlmCacheKeyInput, value: string): Promise<void> {
    if (!this.enabled) return;

    const hash = this.storageKey(input);
    this.lru.set(hash, value);

    if (!this.redis) return;

    try {
      await this.redis.set(this.redisKey(hash), value, 'EX', ttlSec());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Logger.debug(`[llm-cache] Redis set failed: ${msg}`);
    }
  }

  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
    this.lru.clear();
  }
}
