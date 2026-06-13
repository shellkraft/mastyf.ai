/**
 * Per-tenant daily budget — hot-path spend tracking for semantic/LLM gates.
 */
import { getDailyBudgetCapUsd } from './cost-auditor.js';
import { Logger } from '../utils/logger.js';

const spendByTenantDay = new Map<string, number>();

function utcDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function cacheKey(tenantId: string): string {
  return `${utcDayKey()}:${tenantId}`;
}

/** Record USD spend after a persisted call (proxy hot path). */
export function recordTenantDailySpend(tenantId: string | undefined, costUsd: number): void {
  if (!costUsd || costUsd <= 0) return;
  const tid = tenantId?.trim() || 'default';
  const key = cacheKey(tid);
  spendByTenantDay.set(key, (spendByTenantDay.get(key) ?? 0) + costUsd);
}

export function getEstimatedSemanticCostUsd(): number {
  const v = parseFloat(process.env.MASTYFF_AI_SEMANTIC_ESTIMATED_COST_USD || '0.003');
  return Number.isFinite(v) && v > 0 ? v : 0.003;
}

/** Synchronous budget check before enqueueing LLM semantic work. */
export function isTenantDailyBudgetExceeded(
  tenantId?: string,
  additionalUsd = 0,
): { exceeded: boolean; spentUsd: number; capUsd: number } {
  const tid = tenantId?.trim() || 'default';
  const capUsd = getDailyBudgetCapUsd(tid);
  if (capUsd <= 0) {
    return { exceeded: false, spentUsd: 0, capUsd: 0 };
  }
  const spentUsd = spendByTenantDay.get(cacheKey(tid)) ?? 0;
  const projected = spentUsd + additionalUsd;
  if (projected >= capUsd) {
    Logger.warn(
      `[tenant-budget] Tenant ${tid} daily cap exceeded (${projected.toFixed(4)} >= ${capUsd} USD)`,
    );
    return { exceeded: true, spentUsd, capUsd };
  }
  return { exceeded: false, spentUsd, capUsd };
}

/** @internal tests */
export function resetTenantBudgetCacheForTests(): void {
  spendByTenantDay.clear();
}
