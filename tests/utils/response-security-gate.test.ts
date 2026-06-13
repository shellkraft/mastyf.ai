import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { gateToolResponseText } from '../../src/utils/response-security-gate.js';
import { PolicyEngine } from '../../src/policy/policy-engine.js';

describe('response security gate', () => {
  const prev: Record<string, string | undefined> = {};

  beforeEach(() => {
    prev['MASTYFF_AI_RESPONSE_DLP_MODE'] = process.env['MASTYFF_AI_RESPONSE_DLP_MODE'];
    prev['MASTYFF_AI_SEMANTIC_SYNC_RESPONSE'] = process.env['MASTYFF_AI_SEMANTIC_SYNC_RESPONSE'];
    delete process.env['MASTYFF_AI_SEMANTIC_SYNC_RESPONSE'];
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('blocks DLP violations in block mode', async () => {
    process.env['MASTYFF_AI_RESPONSE_DLP_MODE'] = 'block';
    const policy = new PolicyEngine({
      version: '1.0',
      policy: { mode: 'block', default_action: 'block', rules: [] },
    });
    const gate = await gateToolResponseText({
      responseText: JSON.stringify({ output: 'patient ssn 123-45-6789' }),
      toolName: 'run',
      serverName: 'srv',
      policy,
    });
    expect(gate.outcome.action).toBe('block');
    if (gate.outcome.action === 'block') {
      expect(gate.outcome.rule).toBe('response-dlp');
    }
  });

  it('redacts secrets in redact mode', async () => {
    process.env['MASTYFF_AI_RESPONSE_DLP_MODE'] = 'redact';
    const policy = new PolicyEngine({
      version: '1.0',
      policy: { mode: 'block', default_action: 'block', rules: [] },
    });
    const gate = await gateToolResponseText({
      responseText: JSON.stringify({ output: 'patient ssn 123-45-6789' }),
      toolName: 'run',
      serverName: 'srv',
      policy,
    });
    expect(gate.outcome.action).toBe('redact');
    if (gate.outcome.action === 'redact') {
      expect(gate.outcome.body).not.toContain('123-45-6789');
    }
  });
});
