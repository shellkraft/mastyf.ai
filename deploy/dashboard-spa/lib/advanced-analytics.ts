import type {
  AnalyticsSummaryResponse,
  CostResponse,
  HealthResponse,
  SecurityResponse,
  SemanticOutcome,
  ThreatDiscoveryStatus,
} from './mastyff-ai-api';

type ConfidenceBand = 'high' | 'medium' | 'low';

export type MetricCaveat = {
  confidence: ConfidenceBand;
  sampleSize: number;
  coveragePct: number;
  notes: string[];
};

export type PolicyImpactMetrics = {
  simulatedBlockDelta: number;
  fpRiskPct: number;
  estimatedSavingsUsd: number;
  estimatedSavingsRangeUsd: { conservative: number; base: number; aggressive: number };
  backtestAgreementPct: number;
  caveat: MetricCaveat;
};

export type ThreatConversionMetrics = {
  conversionRatePct: number;
  medianConfidencePct: number;
  reviewBacklogPct: number;
  semanticTpToCandidateCoveragePct: number;
  caveat: MetricCaveat;
};

export type ReliabilityRiskMetrics = {
  index: number;
  status: 'stable' | 'watch' | 'critical';
  p95DriftPct: number;
  successGapPct: number;
  circuitBreakerOpenPct: number;
  caveat: MetricCaveat;
};

export type CostRiskRoiMetrics = {
  expectedLossAvoidedUsd: number;
  securityOperationalCostUsd: number;
  netSecurityRoiUsd: number;
  caveat: MetricCaveat;
};

export type DriftMetrics = {
  trafficShiftPct: number;
  blockRateShiftPct: number;
  modelMixJSDivergence: number;
  changeDetected: boolean;
  caveat: MetricCaveat;
};

export type WorkloadPriorityRow = {
  id: string;
  toolName: string;
  priorityScore: number;
  estimatedRiskReduction: number;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function pct(numerator: number, denominator: number): number {
  if (!Number.isFinite(denominator) || denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function caveatFromCoverage(sampleSize: number, coveragePct: number, notes: string[] = []): MetricCaveat {
  const score = (sampleSize >= 100 ? 1 : sampleSize >= 30 ? 0.6 : 0.3) * (coveragePct >= 90 ? 1 : coveragePct >= 70 ? 0.7 : 0.4);
  const confidence: ConfidenceBand = score >= 0.8 ? 'high' : score >= 0.45 ? 'medium' : 'low';
  return { confidence, sampleSize, coveragePct: Math.round(coveragePct), notes };
}

function parseCounterfactualNumber(input: unknown, key: string): number {
  if (!input || typeof input !== 'object') return 0;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function computePolicyImpactMetrics(
  counterfactual: Record<string, unknown> | null,
  avgCostPerBlockedCallUsd: number,
): PolicyImpactMetrics {
  const newBlocks = parseCounterfactualNumber(counterfactual, 'newBlocks');
  const newPasses = parseCounterfactualNumber(counterfactual, 'newPasses');
  const fpRiskScore = parseCounterfactualNumber(counterfactual, 'fpRiskScore');
  const sampleSize = Math.max(1, newBlocks + newPasses);
  const baseSavings = Math.max(0, newBlocks * Math.max(0, avgCostPerBlockedCallUsd));
  const deltas = Array.isArray(counterfactual?.deltas)
    ? (counterfactual?.deltas as Array<Record<string, unknown>>)
    : [];
  const agreementHits = deltas.filter((d) => String(d.direction || '').toLowerCase().includes('block')).length;
  const backtestAgreementPct = pct(agreementHits, Math.max(1, deltas.length));
  return {
    simulatedBlockDelta: newBlocks - newPasses,
    fpRiskPct: clamp(fpRiskScore * 100, 0, 100),
    estimatedSavingsUsd: baseSavings,
    estimatedSavingsRangeUsd: {
      conservative: baseSavings * 0.6,
      base: baseSavings,
      aggressive: baseSavings * 1.6,
    },
    backtestAgreementPct,
    caveat: caveatFromCoverage(sampleSize, 85, [
      'Savings estimate uses historical average cost per blocked call.',
      'Counterfactual output is directional, not a guaranteed future outcome.',
    ]),
  };
}

export function computeThreatConversionMetrics(
  threatStatus: ThreatDiscoveryStatus | null,
  semantic: SemanticOutcome[],
): ThreatConversionMetrics {
  const stats = threatStatus?.threatLab.stats;
  const total = Math.max(0, stats?.total ?? 0);
  const accepted = Math.max(0, stats?.accepted ?? 0);
  const pending = Math.max(0, stats?.pending ?? 0);
  const confidenceValues = (threatStatus?.threatLab.manifest?.candidates ?? []).map((c) => c.confidence * 100);
  const tpCount = semantic.filter((s) => s.label === 'true_positive').length;
  const coverage = pct(accepted, Math.max(1, tpCount));
  return {
    conversionRatePct: pct(accepted, Math.max(1, total)),
    medianConfidencePct: median(confidenceValues),
    reviewBacklogPct: pct(pending, Math.max(1, total)),
    semanticTpToCandidateCoveragePct: coverage,
    caveat: caveatFromCoverage(total, tpCount > 0 ? clamp(coverage, 0, 100) : 75, [
      'Coverage compares accepted Threat Lab candidates to labeled semantic true positives.',
    ]),
  };
}

export function computeThreatConversionFromCandidates(
  candidates: Array<{ reviewStatus?: string; confidence: number; provenance?: { inputFingerprint?: string } }>,
  semanticTpCount: number,
): ThreatConversionMetrics {
  const total = candidates.length;
  const accepted = candidates.filter((c) => c.reviewStatus === 'accepted').length;
  const pending = candidates.filter((c) => c.reviewStatus === 'pending' || !c.reviewStatus).length;
  const acceptedConfidence = candidates
    .filter((c) => c.reviewStatus === 'accepted')
    .map((c) => c.confidence * 100);
  const matchedTp = new Set(
    candidates
      .filter((c) => c.reviewStatus === 'accepted' && c.provenance?.inputFingerprint)
      .map((c) => String(c.provenance?.inputFingerprint)),
  ).size;
  const coverage = pct(matchedTp, Math.max(1, semanticTpCount));
  return {
    conversionRatePct: pct(accepted, Math.max(1, total)),
    medianConfidencePct: median(acceptedConfidence),
    reviewBacklogPct: pct(pending, Math.max(1, total)),
    semanticTpToCandidateCoveragePct: coverage,
    caveat: caveatFromCoverage(total, semanticTpCount > 0 ? clamp(coverage, 0, 100) : 75, [
      'Coverage estimates accepted candidate linkage to semantic true positives.',
    ]),
  };
}

export function computeReliabilityRiskMetrics(
  health: HealthResponse | null,
  byServer: Array<{ latencyP50Ms?: number; latencyP95Ms?: number; serverName: string }> = [],
): ReliabilityRiskMetrics {
  const reports = health?.serverReports ?? [];
  const serverCount = reports.length || 1;
  const p95Drifts = byServer.map((s) => {
    const p50 = Math.max(1, s.latencyP50Ms ?? 0);
    const p95 = Math.max(0, s.latencyP95Ms ?? 0);
    return pct(p95 - p50, p50);
  });
  const avgDrift = p95Drifts.length ? p95Drifts.reduce((a, b) => a + b, 0) / p95Drifts.length : 0;
  const successGap = reports.reduce((sum, r) => sum + (100 - (r.successRate ?? 100)), 0) / serverCount;
  const cbOpen = reports.filter((r) => String(r.circuitBreaker || '').toUpperCase() !== 'CLOSED').length;
  const cbOpenPct = pct(cbOpen, serverCount);
  const raw = avgDrift * 0.35 + successGap * 0.45 + cbOpenPct * 0.2;
  const index = clamp(Math.round(raw), 0, 100);
  return {
    index,
    status: index >= 60 ? 'critical' : index >= 35 ? 'watch' : 'stable',
    p95DriftPct: avgDrift,
    successGapPct: successGap,
    circuitBreakerOpenPct: cbOpenPct,
    caveat: caveatFromCoverage(reports.length, reports.length ? 95 : 0, [
      'Risk index weights: success gap 45%, p95 drift 35%, circuit-breaker state 20%.',
    ]),
  };
}

export function computeCostRiskRoiMetrics(
  cost: CostResponse | null,
  security: SecurityResponse | null,
): CostRiskRoiMetrics {
  const blockedHighRiskCalls = (security?.serverReports ?? []).reduce(
    (sum, r) => sum + Math.max(0, (r.critical ?? 0) * 3 + (r.high ?? 0)),
    0,
  );
  const lossPerIncidentEstimate = 28;
  const expectedLossAvoidedUsd = blockedHighRiskCalls * lossPerIncidentEstimate;
  const securityOperationalCostUsd = Math.max(0, cost?.totalCost ?? 0) * 0.22;
  return {
    expectedLossAvoidedUsd,
    securityOperationalCostUsd,
    netSecurityRoiUsd: expectedLossAvoidedUsd - securityOperationalCostUsd,
    caveat: caveatFromCoverage(blockedHighRiskCalls, cost?.costCoverage?.coveragePct ?? 70, [
      'Incident-loss assumption is configurable and should be calibrated per tenant.',
    ]),
  };
}

function normalizeDistribution(values: number[]): number[] {
  const total = values.reduce((a, b) => a + Math.max(0, b), 0);
  if (total <= 0) return values.map(() => 0);
  return values.map((v) => Math.max(0, v) / total);
}

function kl(p: number[], q: number[]): number {
  let out = 0;
  for (let i = 0; i < p.length; i += 1) {
    const pv = p[i];
    const qv = q[i];
    if (pv > 0 && qv > 0) out += pv * Math.log2(pv / qv);
  }
  return out;
}

function jsDivergence(p: number[], q: number[]): number {
  const m = p.map((pv, i) => (pv + q[i]) / 2);
  return 0.5 * kl(p, m) + 0.5 * kl(q, m);
}

export function computeDriftMetrics(analytics: AnalyticsSummaryResponse | null): DriftMetrics {
  const series = analytics?.trafficSeries ?? [];
  const half = Math.floor(series.length / 2);
  const baseline = series.slice(0, half);
  const recent = series.slice(half);
  const baselineReq = baseline.reduce((sum, s) => sum + s.requests, 0);
  const recentReq = recent.reduce((sum, s) => sum + s.requests, 0);
  const baselineBlockRate = pct(
    baseline.reduce((sum, s) => sum + s.blocked, 0),
    Math.max(1, baselineReq),
  );
  const recentBlockRate = pct(
    recent.reduce((sum, s) => sum + s.blocked, 0),
    Math.max(1, recentReq),
  );
  const modelUsage = analytics?.modelUsage ?? [];
  const current = normalizeDistribution(modelUsage.map((m) => m.pct));
  const uniform = normalizeDistribution(modelUsage.map(() => 1));
  const divergence = modelUsage.length > 1 ? jsDivergence(current, uniform) : 0;
  const trafficShiftPct = pct(recentReq - baselineReq, Math.max(1, baselineReq));
  const blockRateShiftPct = recentBlockRate - baselineBlockRate;
  return {
    trafficShiftPct,
    blockRateShiftPct,
    modelMixJSDivergence: divergence,
    changeDetected: Math.abs(trafficShiftPct) > 25 || Math.abs(blockRateShiftPct) > 4 || divergence > 0.15,
    caveat: caveatFromCoverage(series.length, series.length >= 6 ? 90 : 55, [
      'Drift compares first-half vs second-half of selected time window.',
    ]),
  };
}

export function computeWorkloadPriority(
  reviewQueue: Array<Record<string, unknown>>,
  abuseScores: Array<Record<string, unknown>>,
): WorkloadPriorityRow[] {
  const abuseByServer = new Map<string, number>();
  for (const s of abuseScores) {
    const key = String(s.serverName || '');
    const score = typeof s.score === 'number' ? s.score : 0;
    if (key) abuseByServer.set(key, score);
  }
  return reviewQueue
    .map((r) => {
      const uncertainty = typeof r.uncertaintyScore === 'number' ? r.uncertaintyScore : 0;
      const severity = typeof r.severityWeight === 'number' ? r.severityWeight : 1;
      const effort = typeof r.effortEstimate === 'number' ? Math.max(0.5, r.effortEstimate) : 1;
      const serverBoost = abuseByServer.get(String(r.serverName || '')) ?? 0;
      const priorityScore = ((uncertainty * 60 + serverBoost * 0.8) * severity) / effort;
      return {
        id: String(r.id || ''),
        toolName: String(r.toolName || '—'),
        priorityScore,
        estimatedRiskReduction: clamp(priorityScore * 0.35, 0, 100),
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 5);
}
