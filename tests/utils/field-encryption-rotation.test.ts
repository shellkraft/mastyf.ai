import { describe, expect, it } from 'vitest';
import { decryptField, encryptField, getFieldEncryptionStatus } from '../../src/utils/field-encryption.js';

describe('field-encryption rotation', () => {
  it('encrypts with v3 key-version prefix', () => {
    process.env.MASTYFF_AI_DB_ENCRYPTION_KEY = 'rotate-secret';
    process.env.MASTYFF_AI_DB_ENCRYPTION_KEY_VERSION = 'v2';
    const enc = encryptField('hello')!;
    expect(enc.startsWith('genc3:v2:')).toBe(true);
    expect(decryptField(enc)).toBe('hello');
  });

  it('reports encryption status', () => {
    process.env.MASTYFF_AI_DB_ENCRYPTION_ROTATION_ENABLED = 'true';
    const status = getFieldEncryptionStatus();
    expect(status.rotationEnabled).toBe(true);
  });
});
