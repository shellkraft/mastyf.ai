import { describe, it, expect } from 'vitest';
import { InMemoryDPoPNonceStore } from '../../src/auth/dpop-nonce-store.js';

describe('DPoP nonce store', () => {
  it('claim rejects replay (SETNX-equivalent)', async () => {
    const store = new InMemoryDPoPNonceStore(60_000);
    expect(await store.claim('jti-1')).toBe(true);
    expect(await store.claim('jti-1')).toBe(false);
    expect(await store.claim('jti-2')).toBe(true);
  });
});
