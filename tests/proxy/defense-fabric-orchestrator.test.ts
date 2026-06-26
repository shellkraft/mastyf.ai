import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { evaluateToolCallDefense } from '../../src/proxy/tool-call-defense-orchestrator.js';
import type { PolicyEngine } from '../../src/policy/policy-engine.js';
import { resetToolRegistrationGateForTests } from '../../src/proxy/tool-registration-gate.js';

function mockPolicy(block = false): PolicyEngine {
  return {
    getMode: () => 'block',
    evaluateAsync: vi.fn(async () => ({
      action: block ? 'block' : 'pass',
      rule: block ? 'test-rule' : 'allow',
      reason: block ? 'blocked' : 'ok',
    })),
  } as unknown as PolicyEngine;
}

describe('Defense Fabric orchestrator', () => {
  beforeEach(() => {
    process.env.MASTYF_AI_SEMANTIC_ASYNC = 'false';
    process.env.MASTYF_AI_SEMANTIC_SYNC_REQUEST = 'false';
    resetToolRegistrationGateForTests();
  });

  afterEach(() => {
    delete process.env.MASTYF_AI_SEMANTIC_ASYNC;
    delete process.env.MASTYF_AI_SEMANTIC_SYNC_REQUEST;
    delete process.env.MASTYF_AI_BLOCK_CRITICAL_TOOLS;
  });

  it('allows clean tool calls through policy + gates', async () => {
    const outcome = await evaluateToolCallDefense(
      {
        serverName: 'filesystem',
        toolName: 'read_file',
        arguments: { path: '.' },
        requestId: '1',
        requestTokens: 10,
        tenantId: 'default',
      },
      { policyEngine: mockPolicy(false) },
    );
    expect(outcome.allowed).toBe(true);
  });

  it('blocks on policy deny', async () => {
    const outcome = await evaluateToolCallDefense(
      {
        serverName: 'filesystem',
        toolName: 'evil',
        arguments: {},
        requestId: '2',
        requestTokens: 10,
        tenantId: 'default',
      },
      { policyEngine: mockPolicy(true) },
    );
    expect(outcome.allowed).toBe(false);
    if (!outcome.allowed) {
      expect(outcome.phase).toBe('policy');
    }
  });
});
