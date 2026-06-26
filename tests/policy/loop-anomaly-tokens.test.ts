import { describe, expect, it } from 'vitest';
import { evaluateLoopAnomalyGuard } from '../../src/policy/loop-anomaly-detector.js';
import { recordSessionToolCall, flowSessionKey } from '../../src/policy/session-flow-guard.js';
import type { CallContext } from '../../src/policy/policy-types.js';

function ctx(tool: string, args: Record<string, unknown>, tokens: number): CallContext {
  return {
    serverName: 'srv',
    toolName: tool,
    arguments: args,
    requestTokens: tokens,
    timestamp: new Date().toISOString(),
    tenantId: 'default',
    agentIdentity: { sub: 'agent-1' },
  };
}

describe('loop-anomaly tokens', () => {
  it('blocks when token burn per minute exceeds cap', () => {
    process.env.MASTYF_AI_LOOP_TOKENS_PER_MIN = '100';
    const base = ctx('run', { cmd: 'ls' }, 60);
    const key = flowSessionKey(base);
    for (let i = 0; i < 5; i++) {
      recordSessionToolCall(ctx('run', { cmd: `ls-${i}` }, 30));
    }
    const block = evaluateLoopAnomalyGuard(ctx('run', { cmd: 'ls-final' }, 50));
    expect(block?.rule).toBe('loop-anomaly-perturbation');
    expect(block?.reason).toContain('token burn');
    void key;
  });
});
