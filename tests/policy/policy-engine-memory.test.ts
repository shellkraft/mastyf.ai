import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PolicyEngine } from '../../src/policy/policy-engine.js';
import type { PolicyConfig, CallContext } from '../../src/policy/policy-types.js';

const rateLimitPolicy: PolicyConfig = {
  version: '1.0',
  policy: {
    mode: 'audit',
    rules: [
      {
        name: 'rate-limit',
        action: 'flag',
        maxCallsPerMinute: 1000,
      },
    ],
  },
};

function makeContext(i: number): CallContext {
  return {
    serverName: 'mem-test',
    toolName: 'tool',
    arguments: {},
    requestId: `req-${i}`,
    requestTokens: 1,
    timestamp: new Date().toISOString(),
    agentIdentity: { sub: `user-${i}`, clientId: `client-${i}` },
  };
}

describe('PolicyEngine memory bounds', () => {
  beforeEach(() => {
    // Sync evaluate() spins for MASTYFF_AI_POLICY_MIN_EVAL_MS (default 25ms) per call.
    // A 120k-client loop would take ~50 minutes and block the entire vitest worker.
    process.env['MASTYFF_AI_POLICY_TIMING_ENVELOPE'] = 'false';
  });

  afterEach(() => {
    delete process.env['MASTYFF_AI_POLICY_TIMING_ENVELOPE'];
  });

  it('keeps rate-limit LRU at max entries after many unique clients', () => {
    const engine = new PolicyEngine(rateLimitPolicy);
    const counters = (engine as unknown as { callCounters: { size: number; max: number } })
      .callCounters;
    const lruMax = counters.max;
    // Exceed the LRU cap to prove eviction; no need for 120k full pipeline evaluations.
    const uniqueClients = lruMax + Math.ceil(lruMax * 0.04);

    for (let i = 0; i < uniqueClients; i++) {
      engine.evaluate(makeContext(i), { yamlOnly: true, applyTimingEnvelope: false });
    }

    expect(counters.size).toBeLessThanOrEqual(lruMax);
    expect(counters.size).toBe(lruMax);
  });
});
