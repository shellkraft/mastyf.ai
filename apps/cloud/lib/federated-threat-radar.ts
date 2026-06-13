import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';

export type FederatedRadarResult = {
  attackClassCounts: Record<string, number>;
  ruleEfficacy: Array<{ rule: string; blocks: number }>;
  instanceCount: number;
  generatedAt: string;
};

export async function upsertFederatedThreatStats(
  orgId: string,
  instanceId: string,
  stats: {
    tenantId: string;
    region?: string;
    attackClassCounts: Record<string, number>;
    ruleEfficacy: Array<{ rule: string; blocks: number }>;
    thresholdRecommendation: Record<string, unknown>;
  },
): Promise<void> {
  const id = `${orgId}:${instanceId}:${stats.tenantId}`;
  const db = getDb();
  await db.execute(sql`
    INSERT INTO mastyff-ai_federated_threat_stats (
      id, org_id, instance_id, tenant_id, region,
      attack_class_counts, rule_efficacy, threshold_recommendation, last_seen
    ) VALUES (
      ${id},
      ${orgId},
      ${instanceId},
      ${stats.tenantId},
      ${stats.region ?? null},
      ${JSON.stringify(stats.attackClassCounts)}::jsonb,
      ${JSON.stringify(stats.ruleEfficacy)}::jsonb,
      ${JSON.stringify(stats.thresholdRecommendation)}::jsonb,
      NOW()
    )
    ON CONFLICT (org_id, instance_id, tenant_id) DO UPDATE SET
      region = EXCLUDED.region,
      attack_class_counts = EXCLUDED.attack_class_counts,
      rule_efficacy = EXCLUDED.rule_efficacy,
      threshold_recommendation = EXCLUDED.threshold_recommendation,
      last_seen = NOW()
  `);
}

export async function queryFederatedThreatRadar(orgId: string): Promise<FederatedRadarResult> {
  const db = getDb();
  const result = await db.execute(sql`
    SELECT attack_class_counts, rule_efficacy, instance_id
    FROM mastyff-ai_federated_threat_stats
    WHERE org_id = ${orgId}
      AND last_seen >= NOW() - INTERVAL '7 days'
  `);

  const rows = result as unknown as Array<{
    attack_class_counts: Record<string, number>;
    rule_efficacy: Array<{ rule: string; blocks: number }>;
    instance_id: string;
  }>;

  const attackClassCounts: Record<string, number> = {};
  const ruleBlocks = new Map<string, number>();
  const instances = new Set<string>();

  for (const row of rows) {
    instances.add(row.instance_id);
    for (const [cat, n] of Object.entries(row.attack_class_counts || {})) {
      attackClassCounts[cat] = (attackClassCounts[cat] || 0) + Number(n);
    }
    for (const r of row.rule_efficacy || []) {
      ruleBlocks.set(r.rule, (ruleBlocks.get(r.rule) || 0) + r.blocks);
    }
  }

  return {
    attackClassCounts,
    ruleEfficacy: [...ruleBlocks.entries()]
      .map(([rule, blocks]) => ({ rule, blocks }))
      .sort((a, b) => b.blocks - a.blocks)
      .slice(0, 30),
    instanceCount: instances.size,
    generatedAt: new Date().toISOString(),
  };
}
