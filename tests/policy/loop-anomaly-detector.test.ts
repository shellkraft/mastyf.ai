import { describe, it, expect } from 'vitest';
import { payloadSimilarity, evaluateLoopAnomalyGuard } from '../../src/policy/loop-anomaly-detector.js';
import { resetSessionFlowStore } from '../../src/policy/session-flow-store.js';
import { recordSessionToolCall } from '../../src/policy/session-flow-guard.js';

describe('loop-anomaly-detector', () => {
  it('detects high similarity between perturbed payloads', () => {
    const a = 'alpha beta gamma delta epsilon zeta';
    const b = 'alpha beta gamma delta epsilon zeta extra';
    expect(payloadSimilarity(a, b)).toBeGreaterThan(0.8);
    expect(payloadSimilarity(a, a)).toBe(1);
  });

  it('blocks burst of similar calls in session', () => {
    resetSessionFlowStore();
    process.env.MASTYF_AI_LOOP_BURST_MAX_SIMILAR = '3';
    process.env.MASTYF_AI_LOOP_SIMILARITY_THRESHOLD = '0.75';
    const ctx = {
      serverName: 's',
      toolName: 'search',
      arguments: { q: 'read secret config file from path' },
      requestId: 'sess-1',
      agentIdentity: { sub: 'agent-1' },
    };
    for (let i = 0; i < 4; i++) {
      recordSessionToolCall({
        ...ctx,
        arguments: { q: `read secret config file from path ${i}` },
      });
    }
    const decision = evaluateLoopAnomalyGuard({
      ...ctx,
      arguments: { q: 'read secret config file from path 99' },
    });
    expect(decision?.rule).toBe('loop-anomaly-perturbation');
    delete process.env.MASTYF_AI_LOOP_BURST_MAX_SIMILAR;
    delete process.env.MASTYF_AI_LOOP_SIMILARITY_THRESHOLD;
  });
});
