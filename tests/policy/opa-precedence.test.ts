import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PolicyEngine } from '../../src/policy/policy-engine.js';
import { PolicyConfig, CallContext } from '../../src/policy/policy-types.js';
import { resolvePolicyPrecedence } from '../../src/policy/policy-precedence.js';
import { resetOpaCacheForTests } from '../../src/policy/opa-policy.js';

const yamlPolicy: PolicyConfig = {
  version: '1.0',
  policy: {
    mode: 'block',
    opa: true,
    rules: [
      {
        name: 'deny-eval',
        action: 'block',
        tools: { deny: ['eval'] },
      },
    ],
  },
};

function makeContext(overrides: Partial<CallContext> = {}): CallContext {
  return {
    serverName: 'test',
    toolName: 'read_file',
    arguments: {},
    requestId: '1',
    requestTokens: 10,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('OPA / YAML precedence', () => {
  const originalOpaUrl = process.env['OPA_URL'];
  const originalStrict = process.env['MASTYFF_AI_STRICT_MODE'];

  beforeEach(() => {
    vi.restoreAllMocks();
    resetOpaCacheForTests();
  });

  afterEach(() => {
    if (originalOpaUrl === undefined) delete process.env['OPA_URL'];
    else process.env['OPA_URL'] = originalOpaUrl;
    if (originalStrict === undefined) delete process.env['MASTYFF_AI_STRICT_MODE'];
    else process.env['MASTYFF_AI_STRICT_MODE'] = originalStrict;
  });

  it('resolvePolicyPrecedence: OPA block wins over YAML pass', () => {
    const merged = resolvePolicyPrecedence(
      { action: 'block', rule: 'opa', reason: 'OPA denied' },
      { action: 'pass', rule: 'default', reason: 'YAML pass' },
    );
    expect(merged.action).toBe('block');
    expect(merged.rule).toBe('opa');
  });

  it('resolvePolicyPrecedence: YAML block applies when OPA does not block', () => {
    const merged = resolvePolicyPrecedence(null, {
      action: 'block',
      rule: 'deny-eval',
      reason: 'YAML denied',
    });
    expect(merged.action).toBe('block');
    expect(merged.rule).toBe('deny-eval');
  });

  it('evaluateAsync: OPA block + YAML pass → block from OPA', async () => {
    process.env['OPA_URL'] = 'http://opa.test/decision';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ result: { allow: false, reason: 'rego deny' } }), { status: 200 }),
      ),
    );

    const engine = new PolicyEngine(yamlPolicy);
    const decision = await engine.evaluateAsync(makeContext({ toolName: 'read_file' }));
    expect(decision.action).toBe('block');
    expect(decision.rule).toBe('opa');
    expect(decision.reason).toContain('rego deny');
  });

  it('evaluateAsync: OPA pass + YAML block → block from YAML', async () => {
    process.env['OPA_URL'] = 'http://opa.test/decision';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ result: { allow: true } }), { status: 200 }),
      ),
    );

    const engine = new PolicyEngine(yamlPolicy);
    const decision = await engine.evaluateAsync(makeContext({ toolName: 'eval' }));
    expect(decision.action).toBe('block');
    expect(decision.rule).toBe('deny-eval');
  });

  it('evaluateAsync: both deny → OPA block wins', async () => {
    process.env['OPA_URL'] = 'http://opa.test/decision';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ result: { allow: false, reason: 'OPA wins' } }), { status: 200 }),
      ),
    );

    const engine = new PolicyEngine(yamlPolicy);
    const decision = await engine.evaluateAsync(makeContext({ toolName: 'eval' }));
    expect(decision.action).toBe('block');
    expect(decision.rule).toBe('opa');
  });

  it('evaluateAsync: OPA unavailable falls through to YAML block', async () => {
    process.env['OPA_URL'] = 'http://opa.test/decision';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('error', { status: 503 })));

    const engine = new PolicyEngine(yamlPolicy);
    const decision = await engine.evaluateAsync(makeContext({ toolName: 'eval' }));
    expect(decision.action).toBe('block');
    expect(decision.rule).toBe('deny-eval');
  });
});
