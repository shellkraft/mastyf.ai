/**
 * Per-tenant circuit breakers — isolates failure domains across tenants.
 */
import { CircuitBreaker } from './circuit-breaker.js';
import { loadCircuitFromRedis, subscribeCircuitRedisUpdates } from './redis-circuit-sync.js';

const breakers = new Map<string, CircuitBreaker>();
const hydrated = new Set<string>();

export function getCircuitBreaker(tenantId: string, serverName: string): CircuitBreaker {
  const key = `${tenantId || 'default'}:${serverName}`;
  let cb = breakers.get(key);
  if (!cb) {
    cb = new CircuitBreaker(key, { resetTimeoutMs: 15000 });
    breakers.set(key, cb);
    if (!hydrated.has(key)) {
      hydrated.add(key);
      void loadCircuitFromRedis(key).then((snap) => {
        if (snap && breakers.get(key) === cb) {
          cb!.applyRedisSnapshot(snap);
        }
      });
      subscribeCircuitRedisUpdates(key, (snap) => {
        if (breakers.get(key) === cb) {
          cb!.applyRedisSnapshot(snap);
        }
      });
    }
  }
  return cb;
}

/** @internal */
export function resetCircuitBreakerRegistryForTests(): void {
  breakers.clear();
}
