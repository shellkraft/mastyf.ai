import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  allowSemanticLlmCall,
  getSemanticLlmMaxUsdPerMin,
  resetSemanticLlmRateLimitForTests,
} from '../../src/ai/semantic-llm-rate-limit.js';
import { resetTenantBudgetCacheForTests } from '../../src/services/tenant-budget.js';

describe('semantic-llm-rate-limit USD cap', () => {
  const prevMaxMin = process.env.MASTYFF_AI_SEMANTIC_LLM_MAX_PER_MIN;
  const prevMaxUsd = process.env.MASTYFF_AI_SEMANTIC_LLM_MAX_USD_PER_MIN;
  const prevCost = process.env.MASTYFF_AI_SEMANTIC_ESTIMATED_COST_USD;

  beforeEach(() => {
    resetSemanticLlmRateLimitForTests();
    resetTenantBudgetCacheForTests();
    process.env.MASTYFF_AI_SEMANTIC_LLM_MAX_PER_MIN = '100';
    process.env.MASTYFF_AI_SEMANTIC_ESTIMATED_COST_USD = '0.01';
  });

  afterEach(() => {
    resetSemanticLlmRateLimitForTests();
    resetTenantBudgetCacheForTests();
    if (prevMaxMin === undefined) delete process.env.MASTYFF_AI_SEMANTIC_LLM_MAX_PER_MIN;
    else process.env.MASTYFF_AI_SEMANTIC_LLM_MAX_PER_MIN = prevMaxMin;
    if (prevMaxUsd === undefined) delete process.env.MASTYFF_AI_SEMANTIC_LLM_MAX_USD_PER_MIN;
    else process.env.MASTYFF_AI_SEMANTIC_LLM_MAX_USD_PER_MIN = prevMaxUsd;
    if (prevCost === undefined) delete process.env.MASTYFF_AI_SEMANTIC_ESTIMATED_COST_USD;
    else process.env.MASTYFF_AI_SEMANTIC_ESTIMATED_COST_USD = prevCost;
  });

  it('defaults USD cap from count × estimated cost', () => {
    delete process.env.MASTYFF_AI_SEMANTIC_LLM_MAX_USD_PER_MIN;
    expect(getSemanticLlmMaxUsdPerMin()).toBeCloseTo(1.0, 5);
  });

  it('blocks when minute USD budget is exhausted before count cap', async () => {
    process.env.MASTYFF_AI_SEMANTIC_LLM_MAX_USD_PER_MIN = '0.025';
    expect(await allowSemanticLlmCall('usd-tenant')).toBe(true);
    expect(await allowSemanticLlmCall('usd-tenant')).toBe(true);
    expect(await allowSemanticLlmCall('usd-tenant')).toBe(false);
  });
});
