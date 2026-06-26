import { describe, it, expect } from 'vitest';
import { runPostPolicyAllowGates } from '../../src/proxy/proxy-post-allow-gates.js';
import { checkSemanticStrictPrecheck } from '../../src/proxy/semantic-proxy-hooks.js';
import type { CallContext, PolicyDecision } from '../../src/policy/policy-types.js';

const passDecision: PolicyDecision = { action: 'pass', rule: 'allow', reason: 'test' };

function baseContext(overrides: Partial<CallContext> = {}): CallContext {
  return {
    serverName: 'filesystem',
    toolName: 'read_file',
    arguments: { path: '.' },
    requestId: '1',
    requestTokens: 10,
    timestamp: new Date().toISOString(),
    tenantId: 'default',
    ...overrides,
  };
}

describe('transport parity integration (M-007)', () => {
  it('shared post-policy gates behave consistently for allow path', async () => {
    process.env.MASTYF_AI_SEMANTIC_ASYNC = 'false';
    process.env.MASTYF_AI_SEMANTIC_SYNC_REQUEST = 'false';
    const outcome = await runPostPolicyAllowGates(baseContext(), passDecision, 'filesystem');
    expect(outcome === null || ('allowed' in outcome && outcome.allowed)).toBe(true);
    delete process.env.MASTYF_AI_SEMANTIC_ASYNC;
    delete process.env.MASTYF_AI_SEMANTIC_SYNC_REQUEST;
  });

  it('strict precheck blocks identically when LLM unavailable', () => {
    process.env.MASTYF_AI_SEMANTIC_STRICT = 'true';
    process.env.MASTYF_AI_SEMANTIC_ASYNC = 'true';
    process.env.MASTYF_AI_LLM_ENABLED = 'false';
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const block = checkSemanticStrictPrecheck(baseContext(), 'filesystem');
    expect(block?.block).toBe(true);
    expect(block?.rule).toBe('semantic-degraded');
    delete process.env.MASTYF_AI_SEMANTIC_STRICT;
    delete process.env.MASTYF_AI_SEMANTIC_ASYNC;
    delete process.env.MASTYF_AI_LLM_ENABLED;
  });
});
