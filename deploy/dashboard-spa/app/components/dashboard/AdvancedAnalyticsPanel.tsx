'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchActiveLearningReport,
  fetchAgentAbuseScores,
  fetchAnalyticsSummary,
  fetchCost,
  fetchHealth,
  fetchPolicyCounterfactual,
  fetchSecurity,
  fetchSemanticOutcomes,
  fetchThreatDiscoveryStatus,
} from '@/lib/mastyff-ai-api';
import {
  computeCostRiskRoiMetrics,
  computeDriftMetrics,
  computePolicyImpactMetrics,
  computeReliabilityRiskMetrics,
  computeThreatConversionMetrics,
  computeWorkloadPriority,
} from '@/lib/advanced-analytics';
import { DashboardSection } from './DashboardSection';
import { KpiCard } from './KpiCard';
import { useDashboardWindow } from './DashboardWindowContext';

type Props = {
  refreshKey?: number;
};

export function AdvancedAnalyticsPanel({ refreshKey = 0 }: Props) {
  const { window } = useDashboardWindow();
  const [loading, setLoading] = useState(true);
  const [policyImpact, setPolicyImpact] = useState<ReturnType<typeof computePolicyImpactMetrics> | null>(null);
  const [threatConversion, setThreatConversion] = useState<ReturnType<typeof computeThreatConversionMetrics> | null>(null);
  const [reliability, setReliability] = useState<ReturnType<typeof computeReliabilityRiskMetrics> | null>(null);
  const [roi, setRoi] = useState<ReturnType<typeof computeCostRiskRoiMetrics> | null>(null);
  const [drift, setDrift] = useState<ReturnType<typeof computeDriftMetrics> | null>(null);
  const [workload, setWorkload] = useState<Array<{ id: string; toolName: string; priorityScore: number; estimatedRiskReduction: number }>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [counterfactual, cost, security, health, analytics, threatStatus, semanticResp, activeLearning, abuse] =
      await Promise.all([
        fetchPolicyCounterfactual(undefined, 14),
        fetchCost(14),
        fetchSecurity(),
        fetchHealth(),
        fetchAnalyticsSummary(window),
        fetchThreatDiscoveryStatus(),
        fetchSemanticOutcomes(),
        fetchActiveLearningReport(),
        fetchAgentAbuseScores(7),
      ]);
    const blockedCostTotal = Math.max(1, (cost?.serverReports || []).reduce((s, r) => s + Math.max(0, r.cost), 0));
    const nCounterfactual =
      ((counterfactual as { newBlocks?: number })?.newBlocks ?? 0)
      + ((counterfactual as { newPasses?: number })?.newPasses ?? 0);
    const avgCostPerBlockedCall = blockedCostTotal / Math.max(1, nCounterfactual);
    setPolicyImpact(computePolicyImpactMetrics((counterfactual as Record<string, unknown>) || null, avgCostPerBlockedCall));
    setThreatConversion(computeThreatConversionMetrics(threatStatus.status, semanticResp.records));
    setReliability(computeReliabilityRiskMetrics(health, []));
    setRoi(computeCostRiskRoiMetrics(cost, security));
    setDrift(computeDriftMetrics(analytics));
    setWorkload(
      computeWorkloadPriority(
        ((activeLearning?.reviewQueue as Array<Record<string, unknown>>) || []),
        ((abuse?.scores as Array<Record<string, unknown>>) || []),
      ),
    );
    setLoading(false);
  }, [window]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const caveatAlerts = useMemo(() => {
    const messages: string[] = [];
    if (policyImpact?.caveat.confidence === 'low') messages.push('Policy impact confidence is low for this window.');
    if (threatConversion?.caveat.confidence === 'low') messages.push('Threat conversion confidence is low due to sparse candidate coverage.');
    if (reliability?.caveat.confidence === 'low') messages.push('Reliability risk confidence is low due to limited health samples.');
    if (roi?.caveat.confidence === 'low') messages.push('ROI confidence is low because pricing coverage or incident assumptions are weak.');
    if (drift?.caveat.confidence === 'low') messages.push('Drift confidence is low; use a larger time window.');
    return messages;
  }, [drift?.caveat.confidence, policyImpact?.caveat.confidence, reliability?.caveat.confidence, roi?.caveat.confidence, threatConversion?.caveat.confidence]);

  return (
    <DashboardSection
      title="Advanced analytics"
      subtitle="Consolidated decision metrics across policy quality, threat conversion, reliability, ROI, drift, and analyst workload"
    >
      {loading ? <p className="muted">Loading advanced analytics…</p> : null}
      {!loading ? (
        <>
          <div className="kpi-row">
            <KpiCard
              label="Policy impact delta"
              value={policyImpact ? policyImpact.simulatedBlockDelta.toLocaleString() : '—'}
              sub={policyImpact ? `FP risk ${policyImpact.fpRiskPct.toFixed(1)}%` : undefined}
            />
            <KpiCard
              label="Threat conversion"
              value={threatConversion ? `${threatConversion.conversionRatePct.toFixed(1)}%` : '—'}
              sub={threatConversion ? `Backlog ${threatConversion.reviewBacklogPct.toFixed(1)}%` : undefined}
            />
            <KpiCard
              label="Reliability risk index"
              value={reliability ? reliability.index : '—'}
              variant={reliability?.status === 'critical' ? 'danger' : reliability?.status === 'watch' ? 'warn' : 'success'}
              sub={reliability ? reliability.status : undefined}
            />
          </div>
          <div className="kpi-row">
            <KpiCard
              label="Net security ROI"
              value={roi ? `$${roi.netSecurityRoiUsd.toFixed(2)}` : '—'}
              variant={roi && roi.netSecurityRoiUsd >= 0 ? 'success' : 'warn'}
            />
            <KpiCard
              label="Regime shift"
              value={drift?.changeDetected ? 'Detected' : 'Stable'}
              variant={drift?.changeDetected ? 'warn' : 'success'}
              sub={drift ? `JSD ${drift.modelMixJSDivergence.toFixed(3)}` : undefined}
            />
            <KpiCard
              label="Top analyst priority"
              value={workload[0] ? workload[0].priorityScore.toFixed(1) : '—'}
              sub={workload[0] ? `${workload[0].toolName} (${workload[0].estimatedRiskReduction.toFixed(1)}% reduction)` : undefined}
            />
          </div>
          {caveatAlerts.map((msg) => (
            <p key={msg} className="alert">
              {msg}
            </p>
          ))}
        </>
      ) : null}
    </DashboardSection>
  );
}
