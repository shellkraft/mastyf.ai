import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isTenantDailyBudgetExceeded,
  recordTenantDailySpend,
  resetTenantBudgetCacheForTests,
  getEstimatedSemanticCostUsd,
} from '../../src/services/tenant-budget.js';

describe('tenant-budget hot path', () => {
  const prev = process.env.MASTYFF_AI_TENANT_DAILY_BUDGET_JSON;

  beforeEach(() => {
    resetTenantBudgetCacheForTests();
    process.env.MASTYFF_AI_TENANT_DAILY_BUDGET_JSON = JSON.stringify({ acme: 0.01 });
  });

  afterEach(() => {
    resetTenantBudgetCacheForTests();
    if (prev === undefined) delete process.env.MASTYFF_AI_TENANT_DAILY_BUDGET_JSON;
    else process.env.MASTYFF_AI_TENANT_DAILY_BUDGET_JSON = prev;
  });

  it('blocks when projected spend exceeds cap', () => {
    recordTenantDailySpend('acme', 0.009);
    const est = getEstimatedSemanticCostUsd();
    const r = isTenantDailyBudgetExceeded('acme', est);
    expect(r.exceeded).toBe(true);
    expect(r.capUsd).toBe(0.01);
  });

  it('allows under cap', () => {
    const r = isTenantDailyBudgetExceeded('acme', 0.001);
    expect(r.exceeded).toBe(false);
  });
});
