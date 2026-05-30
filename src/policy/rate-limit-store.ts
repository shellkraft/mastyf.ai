/**
 * Process-wide rate limit counters — survive PolicyEngine hot-reload swaps.
 */
import { LRUCache } from 'lru-cache';

export type RateCounter = { count: number; resetAt: number };

let callCounters: LRUCache<string, RateCounter> | null = null;
let burstCounters: LRUCache<string, RateCounter> | null = null;

function getCallCounters(): LRUCache<string, RateCounter> {
  if (!callCounters) {
    callCounters = new LRUCache<string, RateCounter>({
      max: 50_000,
      ttl: 60_000,
      updateAgeOnGet: false,
    });
  }
  return callCounters;
}

function getBurstCounters(): LRUCache<string, RateCounter> {
  if (!burstCounters) {
    burstCounters = new LRUCache<string, RateCounter>({
      max: 50_000,
      ttl: 10_000,
      updateAgeOnGet: false,
    });
  }
  return burstCounters;
}

export const sharedRateLimitStore = {
  call: getCallCounters,
  burst: getBurstCounters,
  resetForTests(): void {
    callCounters = null;
    burstCounters = null;
  },
};
