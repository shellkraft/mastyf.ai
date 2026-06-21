'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity } from 'lucide-react';
import {
  fetchAnalyticsSummary,
  trackAdvancedAnalyticsEvent,
  type AnalyticsSummaryResponse,
} from '@/lib/mastyf-ai-api';
import { useDashboardWindow } from '../dashboard/DashboardWindowContext';
import { WindowSegmentedControl } from './WindowSegmentedControl';
import { KpiCard } from '../dashboard/KpiCard';
import { ChartCard } from '../dashboard/ChartCard';
import { CHART_AXIS, CHART_COLORS, CHART_GRID, CHART_TOOLTIP_STYLE } from '@/lib/chartTheme';
import { computeDriftMetrics } from '@/lib/advanced-analytics';

const PROVIDER_COLORS: Record<string, string> = {
  openai: '#22c55e',
  anthropic: '#f97316',
  google: '#3b82f6',
  other: '#94a3b8',
};

const MODEL_COLORS = ['#1d4ed8', '#0891b2', '#ea580c', '#94a3b8', '#6366f1', '#64748b'];

type Props = {
  refreshKey?: number;
  wsConnected?: boolean;
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function AnalyticsDashboardPanel({ refreshKey = 0, wsConnected = false }: Props) {
  const { window, setWindow } = useDashboardWindow();
  const [data, setData] = useState<AnalyticsSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const summary = await fetchAnalyticsSummary(window);
    setData(summary);
    setLoading(false);
  }, [window]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const trafficData = useMemo(
    () =>
      (data?.trafficSeries ?? []).map((p) => ({
        label: new Date(p.bucket).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: window === '1h' || window === '24h' ? 'numeric' : undefined,
        }),
        requests: p.requests,
      })),
    [data?.trafficSeries, window],
  );

  const costData = data?.costSeries ?? [];
  const modelData = data?.modelUsage ?? [];
  const totalCost = costData.reduce((s, c) => s + c.costUsd, 0);
  const windowLabel =
    window === '1h' ? 'Last hour' : window === '24h' ? 'Last 24 hours' : window === '7d' ? 'Last 7 days' : 'Last 30 days';

  const drift = computeDriftMetrics(data);

  useEffect(() => {
    void trackAdvancedAnalyticsEvent({
      feature: 'drift_regime_shift',
      metric: 'changeDetected',
      confidence: drift.caveat.confidence,
      value: drift.changeDetected ? 1 : 0,
    });
  }, [drift.caveat.confidence, drift.changeDetected]);

  return (
    <section className="analytics-dashboard" aria-label="mastyf.ai Analytics">
      <header className="analytics-dashboard-header">
        <div className="analytics-dashboard-title-row">
          <Activity size={22} className="analytics-dashboard-icon" aria-hidden />
          <h2>mastyf.ai Analytics</h2>
          <span className={`analytics-live-badge ${wsConnected ? 'live' : ''}`}>
            <span className="analytics-live-dot" aria-hidden />
            {wsConnected ? 'Live — WebSocket connected' : 'Polling'}
          </span>
        </div>
        <WindowSegmentedControl value={window} onChange={setWindow} />
      </header>

      {data?.emptyReason && !loading ? (
        <p className="hint analytics-empty">{data.emptyReason}</p>
      ) : null}

      <div className="analytics-kpi-row">
        <KpiCard
          label="Total Requests"
          value={(data?.totalRequests ?? 0).toLocaleString()}
          variant="default"
        />
        <KpiCard
          label="Avg Latency"
          value={data?.avgLatencyMs != null ? `${data.avgLatencyMs}ms` : '—'}
          variant="default"
        />
        <KpiCard
          label="Error Rate"
          value={data?.errorRatePct != null ? `${data.errorRatePct}%` : '—'}
          variant={data?.errorRatePct != null && data.errorRatePct > 5 ? 'warn' : 'default'}
        />
        <KpiCard
          label="Tokens Used"
          value={formatTokens(data?.tokensUsed ?? 0)}
          variant="default"
        />
        <KpiCard
          label="Regime shift detector"
          value={drift.changeDetected ? 'Shift detected' : 'Stable'}
          variant={drift.changeDetected ? 'warn' : 'success'}
          sub={`Confidence: ${drift.caveat.confidence}`}
          explanation="Flags major shifts in traffic, block-rate behavior, and model-mix distribution."
        />
      </div>
      <p className="hint">
        Drift signals — traffic {drift.trafficShiftPct.toFixed(1)}%, block-rate {drift.blockRateShiftPct.toFixed(1)}pp, model JSD{' '}
        {drift.modelMixJSDivergence.toFixed(3)}.
      </p>
      {drift.caveat.confidence === 'low' ? (
        <p className="alert">
          Drift detector confidence is low for this window; increase window size for more stable change-point signals.
        </p>
      ) : null}

      <div className="analytics-main-grid">
        <div className="analytics-main-col">
          <ChartCard
            title="Traffic Volume"
            subtitle={windowLabel}
            loading={loading}
            empty={!trafficData.length}
          >
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trafficData}>
                <defs>
                  <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...CHART_GRID} />
                <XAxis dataKey="label" {...CHART_AXIS} interval="preserveStartEnd" />
                <YAxis {...CHART_AXIS} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Area
                  type="monotone"
                  dataKey="requests"
                  stroke="#2563eb"
                  fill="url(#trafficFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Cost Breakdown"
            subtitle={
              totalCost > 0
                ? `$${totalCost.toFixed(2)}${data?.budgetUtilizationPct != null ? ` · Budget ${Math.round(data.budgetUtilizationPct)}%` : ''}`
                : windowLabel
            }
            loading={loading}
            empty={!costData.length}
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={costData}>
                <CartesianGrid {...CHART_GRID} />
                <XAxis dataKey="label" {...CHART_AXIS} />
                <YAxis {...CHART_AXIS} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Cost']} />
                <Bar dataKey="costUsd" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <aside className="analytics-side-col">
          <ChartCard title="Model Usage" loading={loading} empty={!modelData.length}>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={modelData}
                  dataKey="pct"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={2}
                >
                  {modelData.map((_, i) => (
                    <Cell key={modelData[i].model} fill={MODEL_COLORS[i % MODEL_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, 'Share']} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="analytics-model-legend">
              {modelData.map((m, i) => (
                <li key={m.model}>
                  <span
                    className="analytics-legend-swatch"
                    style={{ background: MODEL_COLORS[i % MODEL_COLORS.length] }}
                  />
                  <span>{m.label}</span>
                  <strong>{m.pct}%</strong>
                </li>
              ))}
            </ul>
          </ChartCard>

          <div className="analytics-provider-card">
            <h3>Provider Costs</h3>
            <ul>
              {(data?.providerCosts ?? []).map((p) => (
                <li key={p.provider}>
                  <span
                    className="analytics-provider-dot"
                    style={{ background: PROVIDER_COLORS[p.colorKey] || PROVIDER_COLORS.other }}
                  />
                  <span>{p.label}</span>
                  <strong>${p.costUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                </li>
              ))}
            </ul>
            {!data?.providerCosts?.length && !loading ? (
              <p className="hint">No priced provider breakdown yet.</p>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}
