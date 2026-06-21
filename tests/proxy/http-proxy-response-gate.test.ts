import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PolicyEngine } from '../../src/policy/policy-engine.js';
import { inspectToolResponse } from '../../src/proxy/response-inspection.js';
import { injectRotatedSessionIntoResult } from '../../src/utils/mcp-session-meta.js';

describe('HttpProxyServer response gate', () => {
  const prevMode = process.env.MASTYF_AI_RESPONSE_DLP_MODE;

  afterEach(() => {
    if (prevMode) process.env.MASTYF_AI_RESPONSE_DLP_MODE = prevMode;
    else delete process.env.MASTYF_AI_RESPONSE_DLP_MODE;
  });

  beforeEach(() => {
    process.env.MASTYF_AI_RESPONSE_DLP_MODE = 'block';
  });

  it('blocks tool result via inspectToolResponse in block mode', async () => {
    const policy = new PolicyEngine({
      version: '1.0',
      policy: { mode: 'block', default_action: 'block', rules: [] },
    });

    const msg = {
      jsonrpc: '2.0',
      id: 42,
      result: { note: 'patient ssn 123-45-6789' },
    };
    const inspected = await inspectToolResponse({
      response: msg,
      toolName: 'read_file',
      serverName: 'http-gate',
      requestId: 42,
      policyEngine: policy,
      transportLabel: 'http-proxy',
    });
    expect(inspected.blocked).toBe(true);
    expect(inspected.blockResponse?.error?.code).toBe(-32002);
    expect(String(inspected.blockResponse?.error?.message)).toContain('blocked');
  });

  it('redacts tool result in redact mode', async () => {
    process.env.MASTYF_AI_RESPONSE_DLP_MODE = 'redact';
    const policy = new PolicyEngine({
      version: '1.0',
      policy: { mode: 'block', default_action: 'block', rules: [] },
    });

    const msg = {
      jsonrpc: '2.0',
      id: 7,
      result: { note: 'patient ssn 123-45-6789' },
    };
    const inspected = await inspectToolResponse({
      response: msg,
      toolName: 'read_file',
      serverName: 'http-redact',
      requestId: 7,
      policyEngine: policy,
      transportLabel: 'http-proxy',
    });
    expect(inspected.blocked).toBe(false);
    expect(inspected.redacted).toBe(true);
    expect(inspected.redactionReasons?.length).toBeGreaterThan(0);
    expect(JSON.stringify(msg.result)).not.toContain('123-45-6789');
  });

  it('injectRotatedSessionIntoResult matches http proxy behavior', () => {
    const msg = { jsonrpc: '2.0', id: 3, result: { ok: true } };
    injectRotatedSessionIntoResult(msg, 'http-rotated');
    expect((msg.result as { _meta: { sessionToken: string } })._meta.sessionToken).toBe('http-rotated');
  });
});
