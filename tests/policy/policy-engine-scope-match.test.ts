import { describe, it, expect } from 'vitest';
import { PolicyEngine } from '../../src/policy/policy-engine.js';
import type { PolicyConfig } from '../../src/policy/policy-types.js';

describe('PolicyEngine rbac.scopeMatch', () => {
  const config: PolicyConfig = {
    version: '1.0',
    policy: {
      mode: 'block',
      rules: [
        {
          name: 'require-all-scopes',
          action: 'block',
          rbac: {
            scopes: ['admin', 'write'],
            scopeMatch: 'all',
          },
        },
      ],
    },
  };

  it('blocks when agent has only one of required scopes (all mode)', () => {
    const engine = new PolicyEngine(config);
    const decision = engine.evaluate({
      serverName: 's',
      toolName: 'read_file',
      arguments: {},
      requestId: 'r1',
      requestTokens: 1,
      timestamp: new Date().toISOString(),
      agentIdentity: {
        sub: 'agent-1',
        scopes: ['admin'],
        issuer: 'https://issuer',
      },
    });
    expect(decision.action).toBe('block');
    expect(decision.reason).toMatch(/scope/i);
  });

  it('passes when agent has all required scopes', () => {
    const engine = new PolicyEngine(config);
    const decision = engine.evaluate({
      serverName: 's',
      toolName: 'read_file',
      arguments: {},
      requestId: 'r2',
      requestTokens: 1,
      timestamp: new Date().toISOString(),
      agentIdentity: {
        sub: 'agent-1',
        scopes: ['admin', 'write'],
        issuer: 'https://issuer',
      },
    });
    expect(decision.action).toBe('pass');
  });
});
