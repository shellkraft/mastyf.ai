import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OAuthValidator } from '../../src/auth/oauth.js';

describe('OAuthValidator JWKS refresh', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubEnv('GUARDIAN_JWKS_REFRESH_MS', '1');
    vi.stubEnv('GUARDIAN_OIDC_DISCOVERY_TTL_MS', '60000');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('refreshes JWKS when TTL elapsed before validate', async () => {
    let discoveryCalls = 0;
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes('openid-configuration')) {
        discoveryCalls++;
        return new Response(
          JSON.stringify({
            issuer: 'https://issuer.example',
            jwks_uri: 'https://issuer.example/jwks',
          }),
          { status: 200 },
        );
      }
      if (u.includes('/jwks')) {
        return new Response(JSON.stringify({ keys: [] }), { status: 200 });
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;

    const v = new OAuthValidator({
      issuer: 'https://issuer.example',
      audience: 'mcp-guardian',
      required: false,
    });

    await v.ensureJwksFresh(true);
    await new Promise((r) => setTimeout(r, 5));
    await v.ensureJwksFresh(false);
    expect(discoveryCalls).toBeGreaterThanOrEqual(1);
  });

  it('forces JWKS refresh when ensureJwksFresh(true) is called', async () => {
    let discoveryCalls = 0;
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes('openid-configuration')) {
        discoveryCalls++;
        return new Response(
          JSON.stringify({
            issuer: 'https://issuer.example',
            jwks_uri: 'https://issuer.example/jwks',
          }),
          { status: 200 },
        );
      }
      if (u.includes('/jwks')) {
        return new Response(JSON.stringify({ keys: [] }), { status: 200 });
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;

    const v = new OAuthValidator({
      issuer: 'https://issuer.example',
      audience: 'mcp-guardian',
      required: false,
    });
    await v.ensureJwksFresh(true);
    await v.ensureJwksFresh(true);
    expect(discoveryCalls).toBeGreaterThanOrEqual(2);
  });
});
