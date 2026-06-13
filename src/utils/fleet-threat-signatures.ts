/**
 * Fleet threat signatures — anonymized attack shape aggregation for control-plane sync.
 * No raw payloads; only rule + tool + category + arg-shape hash.
 */
import { createHash } from 'crypto';

export type ThreatSignature = {
  signatureId: string;
  rule: string;
  tool: string;
  category: string;
  argShapeHash: string;
  count: number;
  lastSeen: string;
  region?: string;
};

export type ThreatSignatureInput = {
  rule: string;
  tool: string;
  category?: string;
  argKeys?: string[];
  region?: string;
};

function hashSignature(parts: string[]): string {
  return createHash('sha256').update(parts.join('\0')).digest('hex').slice(0, 16);
}

export function argShapeFromKeys(keys: string[]): string {
  const sorted = [...keys].sort();
  return createHash('sha256').update(sorted.join('|')).digest('hex').slice(0, 12);
}

export function buildThreatSignature(input: ThreatSignatureInput, count = 1): ThreatSignature {
  const category = input.category || 'unknown';
  const argShapeHash = argShapeFromKeys(input.argKeys || []);
  const signatureId = hashSignature([input.rule, input.tool, category, argShapeHash]);
  return {
    signatureId,
    rule: input.rule,
    tool: input.tool,
    category,
    argShapeHash,
    count,
    lastSeen: new Date().toISOString(),
    region: input.region,
  };
}

export function mergeThreatSignatures(
  existing: ThreatSignature[],
  incoming: ThreatSignature[],
): ThreatSignature[] {
  const byId = new Map<string, ThreatSignature>();
  for (const s of existing) byId.set(s.signatureId, { ...s });
  for (const s of incoming) {
    const prev = byId.get(s.signatureId);
    if (prev) {
      byId.set(s.signatureId, {
        ...prev,
        count: prev.count + s.count,
        lastSeen: s.lastSeen > prev.lastSeen ? s.lastSeen : prev.lastSeen,
      });
    } else {
      byId.set(s.signatureId, { ...s });
    }
  }
  return [...byId.values()].sort((a, b) => b.count - a.count);
}

export function aggregateThreatSignaturesFromBlocks(
  blocks: Array<{
    rule?: string;
    tool?: string;
    category?: string;
    argKeys?: string[];
  }>,
  region?: string,
): ThreatSignature[] {
  const counts = new Map<string, { input: ThreatSignatureInput; count: number }>();
  for (const b of blocks) {
    const rule = b.rule || 'unknown';
    const tool = b.tool || 'unknown';
    const input: ThreatSignatureInput = {
      rule,
      tool,
      category: b.category,
      argKeys: b.argKeys,
      region,
    };
    const sig = buildThreatSignature(input, 0);
    const cur = counts.get(sig.signatureId) || { input, count: 0 };
    cur.count += 1;
    counts.set(sig.signatureId, cur);
  }
  return [...counts.values()].map(({ input, count }) => buildThreatSignature(input, count));
}

export async function collectHeartbeatThreatSignatures(): Promise<ThreatSignature[]> {
  const { loadSemanticAuditRecordsAsync } = await import('../ai/semantic-audit-store.js');
  const { getMastyffAiRegion } = await import('./region.js');
  const records = await loadSemanticAuditRecordsAsync({
    sinceMs: 60 * 60 * 1000,
    limit: 100,
  });
  const blocks = records
    .filter((r) => r.syncDecision?.action === 'block' || r.semanticAudit?.suspicious)
    .map((r) => ({
      rule: r.syncDecision?.rule || 'semantic-flag',
      tool: r.toolName,
      category: r.semanticAudit?.categories?.[0] || 'unknown',
      argKeys: [] as string[],
    }));
  return aggregateThreatSignaturesFromBlocks(blocks, getMastyffAiRegion());
}

export type FleetThreatAlert = {
  signatureId: string;
  regionCount: number;
  totalCount: number;
  message: string;
};

/** Alert when the same signature appears in 3+ regions within the window. */
export function detectCrossRegionThreatAlerts(
  byRegion: Map<string, ThreatSignature[]>,
  minRegions = 3,
): FleetThreatAlert[] {
  const sigRegions = new Map<string, { regions: Set<string>; total: number }>();

  for (const [region, sigs] of byRegion) {
    for (const s of sigs) {
      const cur = sigRegions.get(s.signatureId) || { regions: new Set<string>(), total: 0 };
      cur.regions.add(region);
      cur.total += s.count;
      sigRegions.set(s.signatureId, cur);
    }
  }

  const alerts: FleetThreatAlert[] = [];
  for (const [signatureId, data] of sigRegions) {
    if (data.regions.size >= minRegions) {
      alerts.push({
        signatureId,
        regionCount: data.regions.size,
        totalCount: data.total,
        message: `Signature ${signatureId} seen in ${data.regions.size} regions (${data.total} events)`,
      });
    }
  }
  return alerts.sort((a, b) => b.totalCount - a.totalCount);
}
