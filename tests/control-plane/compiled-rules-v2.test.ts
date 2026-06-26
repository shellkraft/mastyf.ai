import { describe, it, expect } from 'vitest';
import { compilePolicyToRules } from '../../src/control-plane/compiled-rules.js';
import { signCompiledRules, validateSignedCompiledRules } from '../../src/control-plane/compiled-rules-signature.js';
import type { PolicyConfig } from '../../src/policy/policy-types.js';

const samplePolicy: PolicyConfig = {
  version: '2.0.0',
  policy: {
    mode: 'block',
    rules: [
      {
        name: 'deny-delete',
        action: 'block',
        tools: { deny: ['delete_all'] },
        maxTokensPerMinute: 100_000,
        maxUsdPerMinute: 5,
      },
    ],
  },
};

describe('compiled rules v2', () => {
  it('emits budget caps in schema v2', () => {
    const rules = compilePolicyToRules(samplePolicy);
    expect(rules.schemaVersion).toBe('v2');
    expect(rules.tokensPerMinuteCap).toBeGreaterThan(0);
    expect(rules.usdPerMinuteCap).toBeGreaterThan(0);
    expect(rules.blockedTools).toContain('delete_all');
  });

  it('signs and validates compiled rules JSON', () => {
    process.env.MASTYF_AI_COMPILED_RULES_SIGNING_KEY = 'test-secret';
    const rules = compilePolicyToRules(samplePolicy);
    const json = JSON.stringify(rules);
    const envelope = signCompiledRules(json, {
      issuer: 'mastyf-ai-admin',
      keyId: 'default',
      issuedAt: new Date().toISOString(),
    });
    expect(validateSignedCompiledRules(json, envelope).ok).toBe(true);
    delete process.env.MASTYF_AI_COMPILED_RULES_SIGNING_KEY;
  });
});
