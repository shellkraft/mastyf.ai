import { describe, it, expect } from 'vitest';
import { PolicyEngine } from '../../src/policy/policy-engine.js';
import type { PolicyConfig, CallContext } from '../../src/policy/policy-types.js';

const clientIdPolicy: PolicyConfig = {
  version: '1.0',
  policy: {
    mode: 'block',
    default_action: 'pass',
    rules: [
      {
        name: 'allow-admin-client',
        action: 'block',
        rbac: { clientIds: ['^admin-.*'] },
      },
    ],
  },
};

function ctx(overrides: Partial<CallContext> = {}): CallContext {
  return {
    serverName: 'srv',
    toolName: 'any_tool',
    requestId: '1',
    requestTokens: 10,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('PolicyEngine RBAC clientId binding (M-013)', () => {
  const engine = new PolicyEngine(clientIdPolicy);

  it('uses JWT-derived clientId from agentIdentity, not spoofed arguments', () => {
    const decision = engine.evaluate(
      ctx({
        agentIdentity: { sub: 'user-1', clientId: 'admin-trusted' },
        arguments: { clientId: 'admin-spoofed' },
      }),
    );
    expect(decision.action).toBe('pass');
  });

  it('blocks when JWT clientId does not match allowlist even if argument claims admin', () => {
    const decision = engine.evaluate(
      ctx({
        agentIdentity: { sub: 'user-2', clientId: 'guest-1' },
        arguments: { clientId: 'admin-spoofed' },
      }),
    );
    expect(decision.action).toBe('block');
    expect(decision.reason).toContain('Client ID');
  });
});
