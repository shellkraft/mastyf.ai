import { describe, it, expect } from 'vitest';
import {
  isEntropySafeValue,
  minEntropyForContext,
  setActiveEntropyPolicy,
} from '../../src/policy/entropy-policy.js';
import { scanForSecrets } from '../../src/scanners/secret-scanner.js';

describe('entropy policy (M-004)', () => {
  it('allowlists UUID v4 via safe_patterns', () => {
    setActiveEntropyPolicy({
      version: '1.0',
      policy: {
        mode: 'block',
        entropy: { safe_patterns: ['uuid-v4'] },
        rules: [],
      },
    });
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(isEntropySafeValue(uuid)).toBe(true);
    const findings = scanForSecrets(uuid, 'args.id', { fieldName: 'id' });
    expect(findings.length).toBe(0);
  });

  it('applies per-tool field min_entropy override', () => {
    setActiveEntropyPolicy({
      version: '1.0',
      policy: {
        mode: 'block',
        entropy: {
          tools: {
            my_tool: { fields: { token: { min_entropy: 2.0 } } },
          },
        },
        rules: [],
      },
    });
    expect(minEntropyForContext('my_tool', 'token')).toBe(2.0);
  });
});
