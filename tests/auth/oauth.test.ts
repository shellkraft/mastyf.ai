import { describe, it, expect, vi, afterEach } from 'vitest';
import { OAuthValidator } from '../../src/auth/oauth.js';

describe('OAuthValidator', () => {
  it('extractToken returns bearer token', () => {
    expect(OAuthValidator.extractToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(OAuthValidator.extractToken('bearer lowercase')).toBe('lowercase');
  });

  it('extractToken returns null for missing or malformed header', () => {
    expect(OAuthValidator.extractToken(undefined)).toBeNull();
    expect(OAuthValidator.extractToken('Basic dXNlcjpwYXNz')).toBeNull();
    expect(OAuthValidator.extractToken('Bearer')).toBeNull();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('validate returns error when JWKS not reachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const validator = new OAuthValidator({
      issuer: 'https://invalid.example.test',
      audience: 'mastyff-ai',
    });
    const result = await validator.validate('not-a-real-jwt');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Auth provider unreachable|JWT validation failed/);
  });
});
