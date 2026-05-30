import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { decryptField, encryptField } from '../../src/utils/field-encryption.js';

describe('field-encryption', () => {
  const prev = process.env.GUARDIAN_DB_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.GUARDIAN_DB_ENCRYPTION_KEY = 'test-key-for-unit-tests-only';
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.GUARDIAN_DB_ENCRYPTION_KEY;
    else process.env.GUARDIAN_DB_ENCRYPTION_KEY = prev;
  });

  it('round-trips sensitive text', () => {
    const plain = 'blocked: secret path /home/user/.ssh/id_rsa';
    const enc = encryptField(plain);
    expect(enc).toMatch(/^genc[123]:/);
    expect(decryptField(enc)).toBe(plain);
  });

  it('passes through plaintext when key unset', () => {
    delete process.env.GUARDIAN_DB_ENCRYPTION_KEY;
    expect(encryptField('hello')).toBe('hello');
    expect(decryptField('hello')).toBe('hello');
  });
});
