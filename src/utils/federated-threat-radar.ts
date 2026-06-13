/**
 * Federated threat radar — privacy-preserving org-level stats (no raw payloads).
 */
import type { StoredSemanticAudit } from '../ai/semantic-audit-store.js';
import { recommendSemanticThresholds } from '../ai/semantic-active-learning.js';

export type FederatedThreatStats = {
  tenantId: string;
  region: string;
  generatedAt: string;
  attackClassCounts: Record<string, number>;
  ruleEfficacy: Array<{ rule: string; blocks: number }>;
  thresholdRecommendation: {
    recommendedMinConfidence: number;
    recommendedLocalThreshold: number;
    labeledCount: number;
    rationale: string;
  };
  optIn: boolean;
};

export function buildLocalFederatedStats(
  tenantId: string,
  region: string,
  semanticRecords: StoredSemanticAudit[],
): FederatedThreatStats {
  const attackClassCounts: Record<string, number> = {};
  const ruleBlocks = new Map<string, number>();

  for (const r of semanticRecords) {
    if (r.semanticAudit?.suspicious) {
      const cat = r.semanticAudit.categories?.[0] || 'unknown';
      attackClassCounts[cat] = (attackClassCounts[cat] || 0) + 1;
    }
    if (r.syncDecision?.action === 'block') {
      const rule = r.syncDecision.rule || 'unknown';
      ruleBlocks.set(rule, (ruleBlocks.get(rule) || 0) + 1);
    }
  }

  const thresholds = recommendSemanticThresholds(semanticRecords);
  const ruleEfficacy = [...ruleBlocks.entries()]
    .map(([rule, blocks]) => ({ rule, blocks }))
    .sort((a, b) => b.blocks - a.blocks)
    .slice(0, 20);

  return {
    tenantId,
    region,
    generatedAt: new Date().toISOString(),
    attackClassCounts,
    ruleEfficacy,
    thresholdRecommendation: {
      recommendedMinConfidence: thresholds.recommendedMinConfidence,
      recommendedLocalThreshold: thresholds.recommendedLocalThreshold,
      labeledCount: thresholds.labeledCount,
      rationale: thresholds.rationale,
    },
    optIn: process.env.MASTYFF_AI_FEDERATED_LEARNING === 'true',
  };
}

export function mergeFederatedStats(stats: FederatedThreatStats[]): {
  attackClassCounts: Record<string, number>;
  ruleEfficacy: Array<{ rule: string; blocks: number }>;
  instanceCount: number;
} {
  const attackClassCounts: Record<string, number> = {};
  const ruleBlocks = new Map<string, number>();

  for (const s of stats) {
    for (const [cat, n] of Object.entries(s.attackClassCounts)) {
      attackClassCounts[cat] = (attackClassCounts[cat] || 0) + n;
    }
    for (const r of s.ruleEfficacy) {
      ruleBlocks.set(r.rule, (ruleBlocks.get(r.rule) || 0) + r.blocks);
    }
  }

  return {
    attackClassCounts,
    ruleEfficacy: [...ruleBlocks.entries()]
      .map(([rule, blocks]) => ({ rule, blocks }))
      .sort((a, b) => b.blocks - a.blocks)
      .slice(0, 30),
    instanceCount: stats.length,
  };
}

export async function collectFederatedThreatStats(): Promise<FederatedThreatStats | null> {
  if (process.env.MASTYFF_AI_FEDERATED_LEARNING !== 'true') return null;
  const { loadSemanticAuditRecordsAsync } = await import('../ai/semantic-audit-store.js');
  const { getMastyffAiRegion } = await import('./region.js');
  const { resolveTenantId } = await import('../tenant/resolve-tenant.js');
  const records = await loadSemanticAuditRecordsAsync({
    sinceMs: 7 * 24 * 60 * 60 * 1000,
    limit: 1000,
  });
  return buildLocalFederatedStats(resolveTenantId(), getMastyffAiRegion(), records);
}
