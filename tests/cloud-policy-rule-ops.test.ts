import { describe, expect, it } from 'vitest';
import { removeRule, setRuleEnabled, summarizeRules } from '../apps/cloud/lib/policy-rule-ops';

const SAMPLE_POLICY = `
version: "1.0"
policy:
  mode: block
  rules:
    - name: block-delete
      action: block
      patterns: ["rm\\\\s+-rf"]
    - name: monitor-logs
      action: flag
`;

describe('cloud policy-rule-ops', () => {
  it('summarizes rules with enabled fallback=true', () => {
    const rules = summarizeRules(SAMPLE_POLICY);
    expect(rules).toHaveLength(2);
    expect(rules[0]?.enabled).toBe(true);
  });

  it('sets rule enabled state', () => {
    const next = setRuleEnabled(SAMPLE_POLICY, 'block-delete', false);
    const rule = summarizeRules(next).find((r) => r.name === 'block-delete');
    expect(rule?.enabled).toBe(false);
  });

  it('removes rule by name', () => {
    const next = removeRule(SAMPLE_POLICY, 'monitor-logs');
    const names = summarizeRules(next).map((r) => r.name);
    expect(names).not.toContain('monitor-logs');
  });
});

