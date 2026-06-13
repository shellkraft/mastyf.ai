import { describe, it, expect, afterEach } from 'vitest';
import { mergeHttpToolsPolicy, isHttpToolsPolicyMergeEnabled } from '../../src/policy/policy-merge.js';
import type { PolicyConfig } from '../../src/policy/policy-types.js';

const base: PolicyConfig = {
  version: '1.0',
  policy: { mode: 'block', rules: [{ name: 'base-rule', action: 'block', tools: { deny: ['bash'] } }] },
};

describe('policy-merge', () => {
  const prev = process.env.MASTYFF_AI_HTTP_TOOLS_POLICY;

  afterEach(() => {
    if (prev === undefined) delete process.env.MASTYFF_AI_HTTP_TOOLS_POLICY;
    else process.env.MASTYFF_AI_HTTP_TOOLS_POLICY = prev;
  });

  it('does not merge when MASTYFF_AI_HTTP_TOOLS_POLICY is unset', () => {
    delete process.env.MASTYFF_AI_HTTP_TOOLS_POLICY;
    expect(isHttpToolsPolicyMergeEnabled()).toBe(false);
    expect(mergeHttpToolsPolicy(base).policy.rules).toHaveLength(1);
  });

  it('merges http-tools template when enabled', () => {
    process.env.MASTYFF_AI_HTTP_TOOLS_POLICY = 'true';
    const merged = mergeHttpToolsPolicy(base);
    expect(merged.policy.rules.some((r) => r.name === 'http-tools-deny-private-urls')).toBe(true);
    expect(merged.policy.rules).toHaveLength(2);
  });
});
