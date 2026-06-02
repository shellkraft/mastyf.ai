'use client';

import { useCallback, useEffect, useState } from 'react';
import { PolicyCopilotPanel } from './PolicyCopilotPanel';
import {
  fetchPolicyRules,
  fetchPolicy,
  removePolicyRule,
  reloadPolicy,
  savePolicy,
  testPolicy,
  togglePolicyRule,
  type ActivePolicyRule,
  type PolicyInfo,
} from '@/lib/guardian-api';
import { hasPermission } from '@/lib/dashboard-roles';

type Props = {
  roles?: string[];
  lastBlocked?: { tool_name: string; server_name: string; reason: string | null } | null;
  onAction?: (msg: string) => void;
  copilotInitialTab?: 'generate' | 'counterfactual';
};

export function PolicyPanel({ roles, lastBlocked, onAction, copilotInitialTab }: Props) {
  const canTest = hasPermission(roles, 'policy_test');
  const canMutate = hasPermission(roles, 'policy_mutate');
  const [policy, setPolicy] = useState<PolicyInfo | null>(null);
  const [draftYaml, setDraftYaml] = useState('');
  const [saving, setSaving] = useState(false);
  const [ruleBusy, setRuleBusy] = useState<string | null>(null);
  const [rules, setRules] = useState<ActivePolicyRule[]>([]);
  const [ruleFilter, setRuleFilter] = useState('');
  const [testResult, setTestResult] = useState('');
  const [testTool, setTestTool] = useState('');
  const [testArgs, setTestArgs] = useState('{"query": "test"}');

  const refresh = useCallback(async () => {
    const [next, nextRules] = await Promise.all([fetchPolicy(), fetchPolicyRules()]);
    setPolicy(next);
    setDraftYaml(next?.yaml ?? '');
    setRules(nextRules);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runTest = async () => {
    if (!canTest) {
      onAction?.('Requires operator role');
      return;
    }
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(testArgs) as Record<string, unknown>;
    } catch {
      setTestResult('Invalid JSON in arguments');
      return;
    }
    const result = await testPolicy({
      tool: testTool || lastBlocked?.tool_name || 'read_file',
      arguments: args,
      server: lastBlocked?.server_name,
    });
    setTestResult(result ? JSON.stringify(result, null, 2) : 'Policy test failed');
  };

  const onReload = async () => {
    if (!canMutate) {
      onAction?.('Requires operator role');
      return;
    }
    const ok = await reloadPolicy();
    onAction?.(ok ? 'Policy reload signaled' : 'Reload failed');
    if (ok) await refresh();
  };

  const dirty = (policy?.yaml ?? '') !== draftYaml;

  const onSave = async () => {
    if (!canMutate) {
      onAction?.('Requires operator role');
      return;
    }
    if (!dirty) {
      onAction?.('No changes to save');
      return;
    }
    setSaving(true);
    try {
      const result = await savePolicy(draftYaml);
      if (result.ok) {
        onAction?.('Policy saved; watcher will hot-reload');
        await refresh();
      } else {
        onAction?.(result.details ? `${result.error}: ${result.details}` : result.error || 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  };

  const onDiscard = () => {
    setDraftYaml(policy?.yaml ?? '');
    onAction?.('Discarded unsaved edits');
  };

  const onToggleRule = async (rule: ActivePolicyRule) => {
    if (!canMutate) return;
    const isCritical = rule.action === 'block' && (rule.patternCount + rule.argPatternCount + rule.denyCount) > 0;
    if (rule.enabled && isCritical) {
      const confirmed = confirm(
        `Disable "${rule.name}"? This appears to be a protection rule and may reduce blocking coverage.`,
      );
      if (!confirmed) return;
    }
    setRuleBusy(rule.name);
    try {
      const result = await togglePolicyRule(rule.name, !rule.enabled);
      if (!result.ok) {
        onAction?.(result.details ? `${result.error}: ${result.details}` : result.error || 'Rule toggle failed');
        return;
      }
      onAction?.(`Rule "${rule.name}" ${rule.enabled ? 'disabled' : 'enabled'}`);
      if (result.warning) onAction?.(result.warning);
      await refresh();
    } finally {
      setRuleBusy(null);
    }
  };

  const onDeleteRule = async (rule: ActivePolicyRule) => {
    if (!canMutate) return;
    if (!confirm(`Delete rule "${rule.name}" from policy YAML?`)) return;
    const isCritical = rule.action === 'block' && (rule.patternCount + rule.argPatternCount + rule.denyCount) > 0;
    if (isCritical) {
      const confirmed = confirm(
        `Delete "${rule.name}"? This appears to be a protection rule and may reduce blocking coverage.`,
      );
      if (!confirmed) return;
    }
    setRuleBusy(rule.name);
    try {
      const result = await removePolicyRule(rule.name);
      if (!result.ok) {
        onAction?.(result.details ? `${result.error}: ${result.details}` : result.error || 'Rule delete failed');
        return;
      }
      onAction?.(`Rule "${rule.name}" deleted`);
      if (result.warning) onAction?.(result.warning);
      await refresh();
    } finally {
      setRuleBusy(null);
    }
  };

  const filteredRules = rules.filter((rule) => {
    const q = ruleFilter.trim().toLowerCase();
    if (!q) return true;
    return rule.name.toLowerCase().includes(q) || rule.action.toLowerCase().includes(q);
  });

  return (
    <section>
      <h2>Policy studio</h2>
      <p className="hint">
        Mode: <strong>{policy?.mode ?? '—'}</strong>
        {policy?.path ? (
          <>
            {' '}
            · <code>{policy.path}</code>
          </>
        ) : null}
      </p>
      <p className="hint">
        You are in <strong>Policy Studio</strong>. Primary goal: create and validate safe policy changes.
        Next step: generate or edit rule, run policy test, then save and reload.
      </p>

      <PolicyCopilotPanel roles={roles} onAction={onAction} initialTab={copilotInitialTab} />

      <h3>Active rules</h3>
      <label className="policy-field">
        Search active rules
        <input
          value={ruleFilter}
          onChange={(e) => setRuleFilter(e.target.value)}
          placeholder="Filter by name or action"
        />
      </label>
      <div className="hint">
        {rules.length} total · {rules.filter((r) => r.enabled).length} enabled · {rules.filter((r) => !r.enabled).length} disabled
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Rule</th>
              <th>Action</th>
              <th>Status</th>
              <th>Matchers</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filteredRules.map((rule) => (
              <tr key={rule.name}>
                <td>{rule.name}</td>
                <td>{rule.action}</td>
                <td>{rule.enabled ? 'Enabled' : 'Disabled'}</td>
                <td>{rule.patternCount + rule.argPatternCount}</td>
                <td className="btn-row">
                  <button
                    type="button"
                    className="secondary"
                    disabled={!canMutate || ruleBusy === rule.name}
                    onClick={() => void onToggleRule(rule)}
                  >
                    {rule.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    disabled={!canMutate || ruleBusy === rule.name}
                    onClick={() => void onDeleteRule(rule)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="btn-row">
        <strong style={{ marginRight: 8 }}>Deploy</strong>
        <button
          type="button"
          disabled={!canMutate || !dirty || saving}
          onClick={() => void onSave()}
        >
          {saving ? 'Saving…' : 'Save policy changes'}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!canMutate || !dirty || saving}
          onClick={onDiscard}
        >
          Discard draft changes
        </button>
        <button type="button" disabled={!canMutate} onClick={() => void onReload()}>
          Reload policy on proxy
        </button>
      </div>
      <div className="btn-row">
        <strong style={{ marginRight: 8 }}>Validate</strong>
        <button
          type="button"
          className="secondary"
          disabled={!canTest}
          onClick={() => {
            if (lastBlocked) {
              setTestTool(lastBlocked.tool_name);
              setTestArgs(JSON.stringify({ query: lastBlocked.reason || 'test' }));
            }
            void runTest();
          }}
        >
          Validate with last blocked example
        </button>
      </div>

      <label className="policy-field">
        Tool name
        <input value={testTool} onChange={(e) => setTestTool(e.target.value)} placeholder="read_file" />
      </label>
      <label className="policy-field">
        Arguments (JSON)
        <textarea
          className="policy-yaml"
          rows={3}
          value={testArgs}
          onChange={(e) => setTestArgs(e.target.value)}
        />
      </label>
      <button type="button" className="secondary" disabled={!canTest} onClick={() => void runTest()}>
        Run manual policy test
      </button>

      {policy?.yaml || canMutate ? (
        <>
          <h3>Active policy YAML{dirty ? ' (unsaved changes)' : ''}</h3>
          <textarea
            className="policy-yaml"
            readOnly={!canMutate}
            rows={18}
            value={draftYaml}
            onChange={(e) => setDraftYaml(e.target.value)}
            spellCheck={false}
          />
        </>
      ) : (
        <p className="muted">No policy file loaded on proxy (start with --policy).</p>
      )}

      {testResult ? <pre className="code-block">{testResult}</pre> : null}
    </section>
  );
}
