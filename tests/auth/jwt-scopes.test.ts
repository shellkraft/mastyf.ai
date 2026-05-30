import { describe, it, expect } from 'vitest';
import { extractJwtScopes } from '../../src/auth/jwt-scopes.js';

describe('extractJwtScopes', () => {
  it('parses space-delimited scope claim', () => {
    expect(extractJwtScopes({ scope: 'read admin' })).toEqual(['read', 'admin']);
  });

  it('merges scp array claim', () => {
    expect(extractJwtScopes({ scope: 'read', scp: ['admin', 'write'] })).toEqual(['read', 'admin', 'write']);
  });
});
