/**
 * Cost coverage metrics — honest labeling for partial pricing.
 */
import type { ProxyCallRecord } from '../types.js';
import { summarizeRecords } from './db-aggregate.js';
import { getRuntimeModelPricing } from '../services/runtime-model-pricing.js';
import { resolveModelIdForServer } from '../config/llm-config.js';

export type CostCoverage = {
  pricedCalls: number;
  unpricedCalls: number;
  totalCalls: number;
  coveragePct: number;
  measuredUsd: number;
  disclaimer: string;
};

const COVERAGE_DISCLAIMER =
  'Spend is estimated from proxied MCP tool calls only. Direct IDE traffic without Mastyff AI is not tracked.';

export function buildCostCoverage(records: ProxyCallRecord[]): CostCoverage {
  const sum = summarizeRecords(records);
  const totalCalls = sum.total;
  const pricedCalls = sum.pricedCalls;
  const unpricedCalls = sum.unpricedCalls;
  const coveragePct =
    totalCalls > 0 ? Math.round((pricedCalls / totalCalls) * 1000) / 10 : 0;
  let disclaimer = COVERAGE_DISCLAIMER;
  if (unpricedCalls > 0) {
    disclaimer += ` ${unpricedCalls} call(s) in this window lack model pricing (${coveragePct}% coverage).`;
  }
  return {
    pricedCalls,
    unpricedCalls,
    totalCalls,
    coveragePct,
    measuredUsd: sum.costUsd,
    disclaimer,
  };
}

/** Reprice records with tokens but zero costUsd using active model rates (display aggregation). */
export async function repriceRecordsForDisplay(
  records: ProxyCallRecord[],
): Promise<{ records: ProxyCallRecord[]; repricedCount: number }> {
  const pricing = getRuntimeModelPricing();
  const active = await pricing.getActivePricing();
  if (!active) return { records, repricedCount: 0 };

  let repricedCount = 0;
  const out = await Promise.all(
    records.map(async (r) => {
      if (r.costUsd != null && r.costUsd > 0) return r;
      const tokens = (r.requestTokens || 0) + (r.responseTokens || 0);
      if (tokens <= 0) return r;

      const model =
        r.model || resolveModelIdForServer(r.serverName) || active.modelId;
      const resolved = model ? await pricing.resolveModelId(model) : active;
      if (!resolved) return r;

      const computed = pricing.computeCost(
        r.requestTokens || 0,
        r.responseTokens || 0,
        resolved,
      );
      if (!computed.priced || computed.costUsd <= 0) return r;
      repricedCount++;
      return {
        ...r,
        costUsd: computed.costUsd,
        model: model || r.model,
        pricingSource: computed.source,
      };
    }),
  );
  return { records: out, repricedCount };
}

export function shouldShowCostHeadline(coverage: CostCoverage, thresholdPct = 80): boolean {
  return coverage.coveragePct >= thresholdPct && coverage.measuredUsd > 0;
}
