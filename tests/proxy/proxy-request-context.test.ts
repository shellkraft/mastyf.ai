import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ProxyRequestContextStore,
  proxyContextTtlMs,
  releaseSpendReservation,
} from '../../src/proxy/proxy-request-context.js';

vi.mock('../../src/services/unified-spend-pool.js', () => ({
  releaseReservedSpend: vi.fn(async () => {}),
}));

describe('ProxyRequestContextStore', () => {
  it('isolates concurrent request state by id', () => {
    const store = new ProxyRequestContextStore();
    store.set(1, {
      requestStartTime: 100,
      createdAt: 100,
      requestToolName: 'a',
      requestTokens: 10,
      requestRaw: '{}',
    });
    store.set(2, {
      requestStartTime: 200,
      createdAt: 200,
      requestToolName: 'b',
      requestTokens: 20,
      requestRaw: '{"x":1}',
    });
    expect(store.get(1)?.requestToolName).toBe('a');
    expect(store.get(2)?.requestToolName).toBe('b');
    store.delete(1);
    expect(store.get(1)).toBeUndefined();
    expect(store.get(2)?.requestToolName).toBe('b');
  });

  it('arms per-id timeouts independently', async () => {
    vi.useFakeTimers();
    const store = new ProxyRequestContextStore();
    const fired: string[] = [];
    store.set('a', {
      requestStartTime: Date.now(),
      createdAt: Date.now(),
      requestToolName: 't1',
      requestTokens: 1,
      requestRaw: '{}',
    });
    store.set('b', {
      requestStartTime: Date.now(),
      createdAt: Date.now(),
      requestToolName: 't2',
      requestTokens: 1,
      requestRaw: '{}',
    });
    store.armTimeout('a', 1000, (id) => fired.push(String(id)));
    store.armTimeout('b', 2000, (id) => fired.push(String(id)));
    await vi.advanceTimersByTimeAsync(1000);
    expect(fired).toEqual(['a']);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fired).toEqual(['a', 'b']);
    vi.useRealTimers();
  });

  it('evicts expired contexts', () => {
    const store = new ProxyRequestContextStore();
    const now = Date.now();
    store.set(1, {
      requestStartTime: now - 10_000,
      createdAt: now - 10_000,
      requestToolName: 'old',
      requestTokens: 1,
      requestRaw: '{}',
    });
    store.set(2, {
      requestStartTime: now,
      createdAt: now,
      requestToolName: 'fresh',
      requestTokens: 1,
      requestRaw: '{}',
    });
    const evicted: string[] = [];
    store.evictExpired(5000, (id) => {
      evicted.push(String(id));
      store.delete(id, false);
    });
    expect(evicted).toEqual(['1']);
    expect(store.get(1)).toBeUndefined();
    expect(store.get(2)?.requestToolName).toBe('fresh');
  });

  it('drains all pending entries for child-death cleanup', () => {
    const store = new ProxyRequestContextStore();
    store.set(1, {
      requestStartTime: 1,
      createdAt: 1,
      requestToolName: 'a',
      requestTokens: 1,
      requestRaw: '{}',
      spendReservationId: 'res-1',
    });
    const seen: string[] = [];
    store.drain((id) => seen.push(String(id)));
    expect(seen.sort()).toEqual(['1']);
    store.clear(false);
    expect(store.size).toBe(0);
  });
});

describe('proxyContextTtlMs', () => {
  afterEach(() => {
    delete process.env['MASTYF_AI_PROXY_CONTEXT_TTL_MS'];
  });

  it('defaults to 2x request timeout', () => {
    expect(proxyContextTtlMs(30_000)).toBe(60_000);
  });

  it('respects env override', () => {
    process.env['MASTYF_AI_PROXY_CONTEXT_TTL_MS'] = '120000';
    expect(proxyContextTtlMs(30_000)).toBe(120_000);
  });
});

describe('releaseSpendReservation', () => {
  beforeEach(async () => {
    const mod = await import('../../src/services/unified-spend-pool.js');
    vi.mocked(mod.releaseReservedSpend).mockClear();
  });

  it('clears reservation id after release', async () => {
    const mod = await import('../../src/services/unified-spend-pool.js');
    const ctx = {
      requestStartTime: 1,
      createdAt: 1,
      requestToolName: 't',
      requestTokens: 1,
      requestRaw: '{}',
      spendReservationId: 'res-abc',
    };
    releaseSpendReservation(ctx);
    expect(ctx.spendReservationId).toBeUndefined();
    expect(mod.releaseReservedSpend).toHaveBeenCalledWith('res-abc');
  });
});
