import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { OAuthValidator } from '../../src/auth/oauth.js';

describe('OAuthValidator JWT', () => {
  let publicJwk: Record<string, unknown>;
  let privateKey: CryptoKey;
  const issuer = 'https://test-issuer.example';
  const audience = 'mastyff-ai-test';

  beforeAll(async () => {
    const { publicKey, privateKey: priv } = await generateKeyPair('RS256');
    privateKey = priv;
    publicJwk = await exportJWK(publicKey);
    publicJwk.kid = 'test-key';
    publicJwk.alg = 'RS256';

    const jwks = { keys: [publicJwk] };
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('.well-known/openid-configuration')) {
        return new Response(JSON.stringify({
          issuer,
          jwks_uri: 'https://test-issuer.example/jwks',
        }));
      }
      if (url.includes('/jwks')) {
        return new Response(JSON.stringify(jwks));
      }
      return new Response('', { status: 404 });
    }));
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('accepts valid JWT with correct audience', async () => {
    const token = await new SignJWT({ scope: 'read admin' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt(Math.floor(Date.now() / 1000))

      .setSubject('agent-1')
      .setExpirationTime('2h')
      .sign(privateKey);

    const validator = new OAuthValidator({ issuer, audience });
    const result = await validator.validate(token);
    expect(result.valid).toBe(true);
    expect(result.identity?.sub).toBe('agent-1');
  });

  it('rejects expired JWT', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt(Math.floor(Date.now() / 1000))

      .setSubject('agent-1')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(privateKey);

    const validator = new OAuthValidator({ issuer, audience });
    const result = await validator.validate(token);
    expect(result.valid).toBe(false);
  });
});
