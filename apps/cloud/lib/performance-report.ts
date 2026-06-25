import { randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { observatorySnapshot } from '@/lib/cloud-observatory-store';

export type PerformanceReport = {
  reportId: string;
  generatedAt: string;
  period: { start: string; end: string; windowDays: number };
  product: {
    organizationCount: number;
    activeApiKeys: number;
    certificationCount: number;
    userCount: number;
  };
  trustApi: {
    packagesScoredTotal: number;
    packagesScoredInWindow: number;
    gradeDistribution: Record<string, number>;
    avgScore: number | null;
    recentPackages: Array<{ packageName: string; score: number; grade: string; computedAt: string }>;
  };
  proxy: {
    activeInstances: number;
    totalToolCalls: number;
    blockedCalls: number;
    totalCostUsd: number;
    topBlockRules: Array<{ rule: string; count: number }>;
  };
  observatory: ReturnType<typeof observatorySnapshot>;
  highlights: string[];
  risks: string[];
};

const GRADE_KEYS = ['A+', 'A', 'B', 'C', 'D', 'F'] as const;

export function parseReportWindowDays(raw: string | null): number {
  if (!raw || raw === '7d' || raw === '7') return 7;
  const m = /^(\d+)d$/.exec(raw.trim());
  if (m) return Math.min(90, Math.max(1, parseInt(m[1]!, 10)));
  const n = parseInt(raw, 10);
  if (Number.isFinite(n)) return Math.min(90, Math.max(1, n));
  return 7;
}

export function aggregateFleetMetrics(
  rows: Array<{ metrics_snapshot: Record<string, unknown> | null }>,
): Pick<PerformanceReport['proxy'], 'totalToolCalls' | 'blockedCalls' | 'totalCostUsd' | 'topBlockRules'> {
  let totalToolCalls = 0;
  let blockedCalls = 0;
  let totalCostUsd = 0;
  const ruleCounts = new Map<string, number>();
  for (const row of rows) {
    const m = row.metrics_snapshot ?? {};
    totalToolCalls += num(m.totalRequests) + num(m.totalToolCalls);
    blockedCalls += num(m.blockedRequests) + num(m.blockedCalls);
    totalCostUsd += num(m.totalCostUsd);
    const rules = m.topBlockRules;
    if (Array.isArray(rules)) {
      for (const r of rules) {
        if (r && typeof r === 'object' && 'rule' in r && 'count' in r) {
          const rule = String((r as { rule: unknown }).rule);
          const count = num((r as { count: unknown }).count);
          ruleCounts.set(rule, (ruleCounts.get(rule) ?? 0) + count);
        }
      }
    }
  }
  const topBlockRules = [...ruleCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([rule, count]) => ({ rule, count }));
  return {
    totalToolCalls,
    blockedCalls,
    totalCostUsd: Math.round(totalCostUsd * 1_000_000) / 1_000_000,
    topBlockRules,
  };
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
}

function emptyGradeDistribution(): Record<string, number> {
  return Object.fromEntries(GRADE_KEYS.map((g) => [g, 0]));
}

export async function buildPerformanceReport(opts: {
  windowDays: number;
  orgId?: string;
}): Promise<PerformanceReport> {
  const db = getDb();
  const windowDays = opts.windowDays;
  const end = new Date();
  const start = new Date(end.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const orgFilter = opts.orgId
    ? sql`AND org_id = ${opts.orgId}`
    : sql``;

  const [orgRow] = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM organizations) AS org_count,
      (SELECT COUNT(*)::int FROM users) AS user_count,
      (SELECT COUNT(*)::int FROM api_keys WHERE revoked_at IS NULL) AS active_keys,
      (SELECT COUNT(*)::int FROM public_mcp_certifications WHERE expires_at > NOW()) AS cert_count
  `);
  const orgStats = (orgRow as unknown as {
    org_count: number;
    user_count: number;
    active_keys: number;
    cert_count: number;
  }) ?? { org_count: 0, user_count: 0, active_keys: 0, cert_count: 0 };

  const pkgTotalRows = await db.execute(sql`
    SELECT COUNT(DISTINCT package_name)::int AS cnt FROM package_score_cache
  `);
  const packagesScoredTotal = Number((pkgTotalRows as unknown as Array<{ cnt: number }>)[0]?.cnt ?? 0);

  const pkgWindowRows = await db.execute(sql`
    SELECT COUNT(DISTINCT package_name)::int AS cnt
    FROM package_score_cache
    WHERE computed_at >= NOW() - (${windowDays} || ' days')::interval
  `);
  const packagesScoredInWindow = Number((pkgWindowRows as unknown as Array<{ cnt: number }>)[0]?.cnt ?? 0);

  const gradeRows = await db.execute(sql`
    SELECT grade, COUNT(*)::int AS cnt
    FROM (
      SELECT DISTINCT ON (package_name) grade, package_name
      FROM package_score_cache
      ORDER BY package_name, computed_at DESC
    ) latest
    GROUP BY grade
  `);
  const gradeDistribution = emptyGradeDistribution();
  for (const row of gradeRows as unknown as Array<{ grade: string; cnt: number }>) {
    if (row.grade in gradeDistribution) {
      gradeDistribution[row.grade] = row.cnt;
    } else {
      gradeDistribution[row.grade] = row.cnt;
    }
  }

  const avgRows = await db.execute(sql`
    SELECT ROUND(AVG(score)::numeric, 1)::float AS avg_score
    FROM (
      SELECT DISTINCT ON (package_name) score, package_name
      FROM package_score_cache
      ORDER BY package_name, computed_at DESC
    ) latest
  `);
  const avgScoreRaw = (avgRows as unknown as Array<{ avg_score: number | null }>)[0]?.avg_score;
  const avgScore = avgScoreRaw != null && Number.isFinite(Number(avgScoreRaw)) ? Number(avgScoreRaw) : null;

  const recentRows = await db.execute(sql`
    SELECT DISTINCT ON (package_name) package_name, score, grade, computed_at
    FROM package_score_cache
    ORDER BY package_name, computed_at DESC
    LIMIT 10
  `);
  const recentPackages = (recentRows as unknown as Array<{
    package_name: string;
    score: number;
    grade: string;
    computed_at: Date | string;
  }>).map((r) => ({
    packageName: r.package_name,
    score: r.score,
    grade: r.grade,
    computedAt: r.computed_at instanceof Date ? r.computed_at.toISOString() : String(r.computed_at),
  }));

  const fleetRows = await db.execute(sql`
    SELECT metrics_snapshot
    FROM mastyf_ai_fleet_instances
    WHERE last_heartbeat > NOW() - INTERVAL '15 minutes'
    ${orgFilter}
  `);
  const fleetSnapshots = (fleetRows as unknown as Array<{ metrics_snapshot: Record<string, unknown> }>);
  const fleetAgg = aggregateFleetMetrics(fleetSnapshots);

  const ruleRows = await db.execute(sql`
    SELECT rule_name, SUM(event_count)::int AS cnt
    FROM mastyf_ai_fleet_threat_signatures
    WHERE last_seen > NOW() - (${windowDays} || ' days')::interval
    ${orgFilter}
    GROUP BY rule_name
    ORDER BY cnt DESC
    LIMIT 10
  `);
  const signatureRules = (ruleRows as unknown as Array<{ rule_name: string; cnt: number }>).map((r) => ({
    rule: r.rule_name,
    count: r.cnt,
  }));
  const topBlockRules = signatureRules.length > 0 ? signatureRules : fleetAgg.topBlockRules;

  const observatory = observatorySnapshot();
  const highlights: string[] = [];
  const risks: string[] = [];

  if (packagesScoredTotal > 0) {
    highlights.push(`${packagesScoredTotal} npm MCP packages scored in cache`);
  }
  if (packagesScoredInWindow > 0) {
    highlights.push(`${packagesScoredInWindow} packages scored in the last ${windowDays} days`);
  }
  if (fleetSnapshots.length > 0) {
    highlights.push(`${fleetSnapshots.length} proxy instance(s) heartbeating`);
  }
  if (orgStats.cert_count > 0) {
    highlights.push(`${orgStats.cert_count} active maintainer certification(s)`);
  }

  if (packagesScoredTotal === 0) {
    risks.push('No package scores cached yet — trust API traction is zero');
  }
  if (fleetSnapshots.length === 0) {
    risks.push('No active proxy heartbeats — run mastyf-ai with MASTYF_AI_CLOUD_API_KEY to populate proxy metrics');
  }
  if (avgScore != null && avgScore < 60) {
    risks.push(`Average cached trust score is ${avgScore}/100 — ecosystem baseline is weak`);
  }

  return {
    reportId: randomUUID(),
    generatedAt: end.toISOString(),
    period: {
      start: start.toISOString(),
      end: end.toISOString(),
      windowDays,
    },
    product: {
      organizationCount: orgStats.org_count,
      activeApiKeys: orgStats.active_keys,
      certificationCount: orgStats.cert_count,
      userCount: orgStats.user_count,
    },
    trustApi: {
      packagesScoredTotal,
      packagesScoredInWindow,
      gradeDistribution,
      avgScore,
      recentPackages,
    },
    proxy: {
      activeInstances: fleetSnapshots.length,
      ...fleetAgg,
      topBlockRules,
    },
    observatory,
    highlights,
    risks,
  };
}
