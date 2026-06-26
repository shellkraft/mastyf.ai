import { describe, it, expect } from 'vitest';
import { ProxySessionAuthStore } from '../../src/proxy/proxy-session-auth.js';

describe('ProxySessionAuthStore', () => {
  it('scopes sticky auth to session id', () => {
    const store = new ProxySessionAuthStore();
    store.setForSession('sess-a', 'Bearer token-a');
    store.setForSession('sess-b', 'Bearer token-b');

    expect(store.getAuthHeader('sess-a', undefined, true)).toBe('Bearer token-a');
    expect(store.getAuthHeader('sess-b', undefined, true)).toBe('Bearer token-b');
    expect(store.getAuthHeader('sess-a', 'Bearer inline', true)).toBe('Bearer inline');
  });

  it('drops auth for previous session on session change', () => {
    const store = new ProxySessionAuthStore();
    store.setForSession('old', 'Bearer old');
    store.onSessionChange('old', 'new');
    store.setForSession('new', 'Bearer new');

    expect(store.getAuthHeader('old', undefined, true)).toBeUndefined();
    expect(store.getAuthHeader('new', undefined, true)).toBe('Bearer new');
  });

  it('clearExcept retains only the active session', () => {
    const store = new ProxySessionAuthStore();
    store.setForSession('keep', 'Bearer keep');
    store.setForSession('drop', 'Bearer drop');
    store.clearExcept('keep');

    expect(store.getAuthHeader('keep', undefined, true)).toBe('Bearer keep');
    expect(store.getAuthHeader('drop', undefined, true)).toBeUndefined();
  });
});
