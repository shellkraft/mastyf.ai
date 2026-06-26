import { describe, expect, it } from 'vitest';
import { evaluateRedisTokenBudget } from '../../src/policy/strategies/token-budget-strategy.js';
import type { CallContext } from '../../src/policy/policy-types.js';

describe('token-budget-strategy', () => {
  it('skips when Redis is not configured', async () => {
    const prev = process.env.REDIS_URL;
    delete process.env.REDIS_URL;
    delete process.env.MASTYF_AI_REDIS_URL;

    const context: CallContext = {
      toolName: 'test_tool',
      serverName: 'test',
      timestamp: new Date().toISOString(),
      requestTokens: 1000,
      tenantId: 'tenant-a',
    };

    const result = await evaluateRedisTokenBudget(context, {
      rules: [{ name: 'cap', action: 'block', maxTokensPerMinute: 100 }],
      resolveAction: (a) => a,
    } as Parameters<typeof evaluateRedisTokenBudget>[1]);

    expect(result.decision).toBeNull();
    if (prev) process.env.REDIS_URL = prev;
  });
});
