import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isTenantDailyBudgetExceeded,
  recordTenantDailySpend,
  resetTenantBudgetCacheForTests,
  getEstimatedSemanticCostUsd,
  tryReserveTenantDailyBudget,
} from '../../src/services/tenant-budget.js';

describe('tenant-budget hot path', () => {
  const prev = process.env.MASTYF_AI_TENANT_DAILY_BUDGET_JSON;

  beforeEach(() => {
    resetTenantBudgetCacheForTests();
    process.env.MASTYF_AI_TENANT_DAILY_BUDGET_JSON = JSON.stringify({ acme: 0.01 });
  });

  afterEach(() => {
    resetTenantBudgetCacheForTests();
    if (prev === undefined) delete process.env.MASTYF_AI_TENANT_DAILY_BUDGET_JSON;
    else process.env.MASTYF_AI_TENANT_DAILY_BUDGET_JSON = prev;
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

  it('tryReserveTenantDailyBudget atomically debits in-process', async () => {
    const ok1 = await tryReserveTenantDailyBudget('acme', 0.004);
    const ok2 = await tryReserveTenantDailyBudget('acme', 0.004);
    const ok3 = await tryReserveTenantDailyBudget('acme', 0.004);
    expect(ok1).toBe(true);
    expect(ok2).toBe(true);
    expect(ok3).toBe(false);
  });
});
