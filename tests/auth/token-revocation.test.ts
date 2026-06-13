import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isBearerTokenRevoked,
  revokeBearerToken,
  resetTokenRevocationForTests,
} from '../../src/auth/token-revocation.js';

describe('token revocation', () => {
  beforeEach(() => {
    resetTokenRevocationForTests();
    process.env['MASTYFF_AI_TOKEN_REVOCATION_REDIS'] = 'false';
  });

  afterEach(() => {
    resetTokenRevocationForTests();
    delete process.env['MASTYFF_AI_TOKEN_REVOCATION_REDIS'];
  });

  it('revokes by jti in memory', async () => {
    const token = 'header.payload.sig';
    expect(await isBearerTokenRevoked(token, 'jti-123')).toBe(false);
    await revokeBearerToken(token, 'jti-123');
    expect(await isBearerTokenRevoked(token, 'jti-123')).toBe(true);
  });

  it('revokes by token hash when jti absent', async () => {
    const token = 'a.b.c';
    await revokeBearerToken(token);
    expect(await isBearerTokenRevoked(token)).toBe(true);
  });
});
