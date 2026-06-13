import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';

export type ThreatSignatureRow = {
  signature_id: string;
  rule_name: string;
  tool_name: string;
  category: string;
  arg_shape_hash: string;
  region: string | null;
  event_count: number;
  instance_count: number;
  last_seen: Date | string;
};

export type FleetThreatGraphResult = {
  signatures: ThreatSignatureRow[];
  alerts: Array<{
    signatureId: string;
    regionCount: number;
    totalCount: number;
    message: string;
  }>;
  generatedAt: string;
};

export async function upsertFleetThreatSignatures(
  orgId: string,
  instanceId: string,
  region: string | undefined,
  signatures: Array<{
    signatureId: string;
    rule: string;
    tool: string;
    category: string;
    argShapeHash: string;
    count: number;
    lastSeen: string;
  }>,
): Promise<number> {
  if (!signatures.length) return 0;
  const db = getDb();
  let n = 0;
  for (const s of signatures) {
    const id = `${orgId}:${s.signatureId}:${instanceId}`;
    await db.execute(sql`
      INSERT INTO mastyff_ai_fleet_threat_signatures (
        id, org_id, signature_id, instance_id, region,
        rule_name, tool_name, category, arg_shape_hash,
        event_count, last_seen
      ) VALUES (
        ${id},
        ${orgId},
        ${s.signatureId},
        ${instanceId},
        ${region ?? null},
        ${s.rule},
        ${s.tool},
        ${s.category},
        ${s.argShapeHash},
        ${s.count},
        ${s.lastSeen}::timestamptz
      )
      ON CONFLICT (org_id, signature_id, instance_id) DO UPDATE SET
        region = EXCLUDED.region,
        rule_name = EXCLUDED.rule_name,
        tool_name = EXCLUDED.tool_name,
        category = EXCLUDED.category,
        arg_shape_hash = EXCLUDED.arg_shape_hash,
        event_count = mastyff_ai_fleet_threat_signatures.event_count + EXCLUDED.event_count,
        last_seen = EXCLUDED.last_seen
    `);
    n++;
  }
  return n;
}

export async function queryFleetThreatGraph(orgId: string, windowHours = 24): Promise<FleetThreatGraphResult> {
  const db = getDb();
  const result = await db.execute(sql`
    SELECT
      signature_id,
      rule_name,
      tool_name,
      category,
      arg_shape_hash,
      region,
      SUM(event_count)::int AS event_count,
      COUNT(DISTINCT instance_id)::int AS instance_count,
      MAX(last_seen) AS last_seen
    FROM mastyff_ai_fleet_threat_signatures
    WHERE org_id = ${orgId}
      AND last_seen >= NOW() - (${windowHours} || ' hours')::interval
    GROUP BY signature_id, rule_name, tool_name, category, arg_shape_hash, region
    ORDER BY event_count DESC
    LIMIT 200
  `);

  const rows = result as unknown as ThreatSignatureRow[];

  const bySig = new Map<string, { regions: Set<string>; total: number }>();
  for (const r of rows) {
    const cur = bySig.get(r.signature_id) || { regions: new Set<string>(), total: 0 };
    if (r.region) cur.regions.add(r.region);
    cur.total += r.event_count;
    bySig.set(r.signature_id, cur);
  }

  const alerts = [...bySig.entries()]
    .filter(([, d]) => d.regions.size >= 3)
    .map(([signatureId, d]) => ({
      signatureId,
      regionCount: d.regions.size,
      totalCount: d.total,
      message: `Signature ${signatureId} active in ${d.regions.size} regions (${d.total} events)`,
    }))
    .sort((a, b) => b.totalCount - a.totalCount);

  return {
    signatures: rows,
    alerts,
    generatedAt: new Date().toISOString(),
  };
}
