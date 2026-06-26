import { describe, expect, it } from 'vitest';
import { runCredentialFormatScan } from '../../packages/core/src/entropy-detector.js';

describe('runCredentialFormatScan', () => {
  it('flags low-entropy sk- shaped keys', () => {
    const weak = 'sk-' + 'a'.repeat(40);
    const issues = runCredentialFormatScan([{ keyPath: 'api_key', value: weak }]);
    expect(issues.some((i) => i.id === 'MCPG-CRED-001')).toBe(true);
  });
});
