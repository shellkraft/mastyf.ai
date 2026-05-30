/**
 * Optional Redis sync for upstream circuit breaker state across replicas.
 */
import { isRedisConfigured, createRedisClient } from './redis-client.js';
import * as Metrics from './metrics.js';
import type { CircuitState } from './circuit-breaker.js';

let redisSingleton: ReturnType<typeof createRedisClient> | null = null;
function redis() {
  if (!redisSingleton) redisSingleton = createRedisClient();
  return redisSingleton;
}

const PREFIX = 'guardian:cb:';
const PUBSUB_CHANNEL = 'guardian:cb:events';
const TTL_SEC = 120;

let subscriberStarted = false;
const remoteListeners = new Map<string, Set<(snap: CircuitRedisSnapshot) => void>>();

export type CircuitRedisSnapshot = {
  state: CircuitState;
  failureCount: number;
  openedAt: number;
};

function recordSyncMetric(op: 'load' | 'save' | 'pubsub', ok: boolean): void {
  Metrics.circuitBreakerSyncTotal.inc({ op, result: ok ? 'ok' : 'error' });
}

export function subscribeCircuitRedisUpdates(
  key: string,
  onUpdate: (snap: CircuitRedisSnapshot) => void,
): () => void {
  if (!isRedisConfigured()) return () => {};
  startCircuitRedisSubscriber();
  let set = remoteListeners.get(key);
  if (!set) {
    set = new Set();
    remoteListeners.set(key, set);
  }
  set.add(onUpdate);
  return () => {
    set?.delete(onUpdate);
    if (set && set.size === 0) remoteListeners.delete(key);
  };
}

function startCircuitRedisSubscriber(): void {
  if (subscriberStarted || !isRedisConfigured()) return;
  subscriberStarted = true;
  try {
    const sub = createRedisClient();
    sub.on('message', (channel: string, message: string) => {
      if (channel !== PUBSUB_CHANNEL) return;
      try {
        const parsed = JSON.parse(message) as { key: string; snap: CircuitRedisSnapshot };
        if (!parsed.key || !parsed.snap) return;
        recordSyncMetric('pubsub', true);
        const listeners = remoteListeners.get(parsed.key);
        if (listeners) {
          for (const fn of listeners) fn(parsed.snap);
        }
      } catch {
        recordSyncMetric('pubsub', false);
      }
    });
    void sub.subscribe(PUBSUB_CHANNEL).catch(() => {
      subscriberStarted = false;
    });
  } catch {
    subscriberStarted = false;
  }
}

export async function loadCircuitFromRedis(key: string): Promise<CircuitRedisSnapshot | null> {
  if (!isRedisConfigured()) return null;
  try {
    const raw = await redis().get(`${PREFIX}${key}`);
    if (!raw) {
      recordSyncMetric('load', true);
      return null;
    }
    recordSyncMetric('load', true);
    return JSON.parse(raw) as CircuitRedisSnapshot;
  } catch {
    recordSyncMetric('load', false);
    return null;
  }
}

export async function saveCircuitToRedis(key: string, snap: CircuitRedisSnapshot): Promise<void> {
  if (!isRedisConfigured()) return;
  try {
    await redis().set(`${PREFIX}${key}`, JSON.stringify(snap), 'EX', TTL_SEC);
    await redis().publish(PUBSUB_CHANNEL, JSON.stringify({ key, snap }));
    recordSyncMetric('save', true);
  } catch {
    recordSyncMetric('save', false);
  }
}

/** @internal */
export function resetCircuitRedisSyncForTests(): void {
  subscriberStarted = false;
  remoteListeners.clear();
  redisSingleton = null;
}
