import { describe, it, expect } from 'vitest';
import { isDpopLockFreeEnabled, claimDpopJtiLockFree } from '../../src/auth/dpop-nonce-store.js';

describe('DPoP lock-free jti claim', () => {
  it('enables lock-free mode by default', () => {
    const prev = process.env.MASTYFF_AI_DPOP_LOCK_FREE;
    delete process.env.MASTYFF_AI_DPOP_LOCK_FREE;
    expect(isDpopLockFreeEnabled()).toBe(true);
    process.env.MASTYFF_AI_DPOP_LOCK_FREE = 'legacy';
    expect(isDpopLockFreeEnabled()).toBe(false);
    if (prev !== undefined) process.env.MASTYFF_AI_DPOP_LOCK_FREE = prev;
    else delete process.env.MASTYFF_AI_DPOP_LOCK_FREE;
  });

  it('claimDpopJtiLockFree rejects replay on in-memory mock', async () => {
    const store = new Map<string, string>();
    const redis = {
      set: async (key: string, _v: string, _ex: string, _ttl: number, nx: string) => {
        if (nx !== 'NX') return null;
        if (store.has(key)) return null;
        store.set(key, '1');
        return 'OK' as const;
      },
      get: async (key: string) => (store.has(key) ? '1' : null),
    };
    const ok1 = await claimDpopJtiLockFree(redis, 'pfx:', 'jti-1', 60, 'tenant-a');
    const ok2 = await claimDpopJtiLockFree(redis, 'pfx:', 'jti-1', 60, 'tenant-a');
    expect(ok1).toBe(true);
    expect(ok2).toBe(false);
  });
});
