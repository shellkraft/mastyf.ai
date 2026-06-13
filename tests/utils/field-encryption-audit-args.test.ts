import { describe, it, expect, vi, afterEach } from 'vitest';
import { encryptAuditArgsField, decryptAuditArgsField } from '../../src/utils/field-encryption.js';

describe('audit args encryption', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('passes through when MASTYFF_AI_DB_ENCRYPT_AUDIT_ARGS is false', () => {
    vi.stubEnv('MASTYFF_AI_DB_ENCRYPTION_KEY', 'test-key-32chars-minimum!!!!!');
    vi.stubEnv('MASTYFF_AI_DB_ENCRYPT_AUDIT_ARGS', 'false');
    expect(encryptAuditArgsField('snippet')).toBe('snippet');
  });

  it('encrypts when flag and key are set', () => {
    vi.stubEnv('MASTYFF_AI_DB_ENCRYPTION_KEY', 'test-key-32chars-minimum!!!!!');
    vi.stubEnv('MASTYFF_AI_DB_ENCRYPT_AUDIT_ARGS', 'true');
    const enc = encryptAuditArgsField('path=/secret');
    expect(enc).not.toBe('path=/secret');
    expect(decryptAuditArgsField(enc)).toBe('path=/secret');
  });
});
