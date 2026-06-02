import { describe, expect, it } from 'vitest';
import { deletePolicyRule, listActiveRules, togglePolicyRule } from '../../src/utils/policy-rule-ops.js';

const SAMPLE_YAML = `
version: "1.0"
policy:
  mode: block
  rules:
    - name: block-delete
      action: block
      tools:
        deny: [delete_file]
    - name: audit-only
      action: flag
      enabled: false
`;

describe('policy-rule-ops', () => {
  it('lists active rules with enabled fallback', () => {
    const rules = listActiveRules(SAMPLE_YAML);
    expect(rules).toHaveLength(2);
    expect(rules[0]?.enabled).toBe(true);
    expect(rules[1]?.enabled).toBe(false);
  });

  it('toggles rule enabled state', () => {
    const nextYaml = togglePolicyRule(SAMPLE_YAML, 'block-delete', false);
    const rules = listActiveRules(nextYaml);
    expect(rules.find((r) => r.name === 'block-delete')?.enabled).toBe(false);
  });

  it('hard deletes rule by name', () => {
    const nextYaml = deletePolicyRule(SAMPLE_YAML, 'audit-only');
    const rules = listActiveRules(nextYaml);
    expect(rules.map((r) => r.name)).not.toContain('audit-only');
    expect(rules).toHaveLength(1);
  });
});

