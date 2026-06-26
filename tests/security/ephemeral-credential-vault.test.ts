import { describe, expect, it } from 'vitest';
import {
  captureEphemeralSecrets,
  redactEphemeralSecrets,
  runWithEphemeralCredentialVault,
} from '../../src/security/ephemeral-credential-vault.js';

describe('ephemeral-credential-vault', () => {
  it('redacts captured secrets from log text', () => {
    runWithEphemeralCredentialVault(() => {
      captureEphemeralSecrets('token sk-123456789012345678901234');
      const redacted = redactEphemeralSecrets('leak sk-123456789012345678901234 here');
      expect(redacted).not.toContain('sk-123456789012345678901234');
      expect(redacted).toContain('[REDACTED_CREDENTIAL]');
    });
  });
});
