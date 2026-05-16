import type { IDatabase } from '../database/database-interface.js';
import type { ProxyCallRecord } from '../types.js';
import { getRuntimeModelPricing } from '../services/runtime-model-pricing.js';
import * as Metrics from './metrics.js';
import { broadcastDashboardEvent } from './dashboard-events.js';

export async function enrichCallRecord(
  record: ProxyCallRecord,
  msg?: unknown,
): Promise<ProxyCallRecord> {
  const pricing = getRuntimeModelPricing();
  const cost = await pricing.computeCostForCall(record.requestTokens, record.responseTokens, msg);
  return {
    ...record,
    model: cost.model,
    costUsd: cost.priced ? cost.costUsd : 0,
    pricingSource: cost.source,
  };
}

export async function persistCallRecord(
  db: IDatabase,
  record: ProxyCallRecord,
  msg?: unknown,
): Promise<ProxyCallRecord> {
  const enriched = await enrichCallRecord(record, msg);
  await db.addCallRecord(enriched);
  broadcastDashboardEvent({
    type: enriched.blocked ? 'policy-block' : 'audit:decision',
    serverName: enriched.serverName,
    payload: {
      toolName: enriched.toolName,
      blocked: !!enriched.blocked,
      blockRule: enriched.blockRule,
      blockReason: enriched.blockReason,
      totalTokens: enriched.totalTokens,
      costUsd: enriched.costUsd,
    },
    timestamp: Date.now(),
  });
  if (enriched.costUsd && enriched.costUsd > 0) {
    await db.addCostRecord(enriched.serverName, enriched.totalTokens, enriched.costUsd);
    Metrics.tokenCostUsd.observe(
      { server_name: enriched.serverName, model: enriched.model || 'unknown' },
      enriched.costUsd,
    );
  }
  return enriched;
}
