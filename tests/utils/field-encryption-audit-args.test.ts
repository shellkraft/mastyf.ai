import { describe, it, expect, vi, afterEach } from 'vitest';
import { encryptAuditArgsField, decryptAuditArgsField } from '../../src/utils/field-encryption.js';

describe('audit args encryption', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('passes through when GUARDIAN_DB_ENCRYPT_AUDIT_ARGS is false', () => {
    vi.stubEnv('GUARDIAN_DB_ENCRYPTION_KEY', 'test-key-32chars-minimum!!!!!');
    vi.stubEnv('GUARDIAN_DB_ENCRYPT_AUDIT_ARGS', 'false');
    expect(encryptAuditArgsField('snippet')).toBe('snippet');
  });

  it('encrypts when flag and key are set', () => {
    vi.stubEnv('GUARDIAN_DB_ENCRYPTION_KEY', 'test-key-32chars-minimum!!!!!');
    vi.stubEnv('GUARDIAN_DB_ENCRYPT_AUDIT_ARGS', 'true');
    const enc = encryptAuditArgsField('path=/secret');
    expect(enc).not.toBe('path=/secret');
    expect(decryptAuditArgsField(enc)).toBe('path=/secret');
  });
});
