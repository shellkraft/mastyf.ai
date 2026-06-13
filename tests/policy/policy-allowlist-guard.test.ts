import { describe, it, expect, vi, afterEach } from 'vitest';
import { validateAllowlistRbac } from '../../src/policy/policy-allowlist-guard.js';
import type { PolicyConfig } from '../../src/policy/policy-types.js';

const base: PolicyConfig = {
  version: '1.0',
  policy: {
    mode: 'block',
    rules: [],
  },
};

describe('validateAllowlistRbac', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws in strict mode when allow rule lacks rbac', () => {
    vi.stubEnv('MASTYFF_AI_STRICT_ALLOWLIST_RBAC', 'true');
    const config: PolicyConfig = {
      ...base,
      policy: {
        ...base.policy,
        rules: [
          {
            name: 'allow-read',
            action: 'pass',
            tools: { allow: ['read_file'] },
          },
        ],
      },
    };
    expect(() => validateAllowlistRbac(config)).toThrow(/rbac/);
  });

  it('passes when allow rule has rbac.scopes', () => {
    vi.stubEnv('MASTYFF_AI_STRICT_ALLOWLIST_RBAC', 'true');
    const config: PolicyConfig = {
      ...base,
      policy: {
        ...base.policy,
        rules: [
          {
            name: 'allow-read',
            action: 'pass',
            tools: { allow: ['read_file'] },
            rbac: { scopes: ['mcp:read'] },
          },
        ],
      },
    };
    expect(() => validateAllowlistRbac(config)).not.toThrow();
  });
});
