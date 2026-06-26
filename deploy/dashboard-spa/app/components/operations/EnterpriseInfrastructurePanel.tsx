'use client';

import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CHART_AXIS,
  CHART_COLORS,
  CHART_GRID,
  CHART_SERIES,
  CHART_TOOLTIP_STYLE,
  classifyRule,
  formatAxisTime,
  ruleCategoryColor,
  topNBuckets,
} from '@/lib/chartTheme';
import { useDashboardWindow } from '@/app/components/dashboard/DashboardWindowContext';
import { useVisuals } from '@/app/components/dashboard/VisualsProvider';
import { formatWindowSubtitle } from '@/lib/format-dashboard-window';
import {
  buildLearningChartSeries,
  learningChartHasValues,
  learningChartTitle,
} from '@/lib/learning-chart-series';
import { ChartPanel } from '@/app/components/ui/ChartPanel';
import { WorkspaceSubNav } from '@/app/components/ui/WorkspaceSubNav';

type TabId = 'traffic' | 'learning' | 'semantic' | 'regression';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'traffic', label: 'Traffic' },
  { id: 'learning', label: 'AI Learning' },
  { id: 'semantic', label: 'Semantic' },
  { id: 'regression', label: 'Servers' },
];

type Props = {
  refreshKey?: number;
};

export function EnterpriseInfrastructurePanel({ refreshKey: _refreshKey = 0 }: Props) {
  const { windowDays, window: windowLabel } = useDashboardWindow();
  const { visuals: data, loading, error } = useVisuals();
  const [tab, setTab] = useState<TabId>('traffic');

  const granularity = windowDays <= 7 ? 'hour' : 'day';
  const windowSubtitle = formatWindowSubtitle(windowLabel);

  const hourly = useMemo(
    () =>
      (data?.traffic?.hourly ?? []).map((h) => ({
        label: formatAxisTime(h.hourStart, granularity),
        passed: h.passed,
        blocked: h.blocked,
        calls: h.calls,
        p50: h.latencyP50Ms ?? 0,
      })),
    [data?.traffic?.hourly, granularity],
  );

  const trafficMeta = data?.meta
    ? {
        window: data.meta.window,
        windowDays: data.windowDays,
        generatedAt: data.meta.generatedAt ?? data.generatedAt,
        recordCount: data.meta.recordCount,
        sparse: data.meta.sparse,
        emptyReason: data.meta.emptyReasons?.traffic,
      }
    : undefined;

  const trafficEmptyReason =
    data?.meta?.emptyReasons?.traffic
    ?? (data?.meta?.dbPath
      ? `No proxy traffic in the selected ${windowLabel} window — widen the time window or route MCP through Mastyf AI. Reading ${data.meta.dbPath}.`
      : `No proxy traffic in the selected ${windowLabel} window — widen the time window or route MCP through Mastyf AI.`);

  const learningSource = data?.instantLearning?.source ?? 'none';
  const learningEmptyReason = data?.meta?.emptyReasons?.instantLearning;

  const learningSeries = useMemo(
    () => buildLearningChartSeries(data?.instantLearning, data?.traffic?.hourly ?? [], granularity),
    [data?.instantLearning, data?.traffic?.hourly, granularity],
  );

  const ruleToolChartData = useMemo(() => {
    const pairs = data?.instantLearning?.ruleToolPairs ?? [];
    if (pairs.length > 0) {
      return pairs.slice(0, 8).map((p) => ({
        name: `${p.rule}:${p.tool}`.slice(0, 20),
        count: p.count,
      }));
    }
    return (data?.traffic?.topBlockRules ?? []).slice(0, 8).map((r) => ({
      name: r.plainEnglish?.slice(0, 20) || r.rule.slice(0, 20),
      count: r.count,
    }));
  }, [data?.instantLearning?.ruleToolPairs, data?.traffic?.topBlockRules]);

  const learningHasData =
    learningChartHasValues(learningSeries) || ruleToolChartData.some((r) => r.count > 0);

  const tools = data?.traffic?.topTools?.slice(0, 8) ?? [];
  const rules = data?.traffic?.topBlockRules?.slice(0, 8) ?? [];
  const servers = data?.traffic?.byServer?.slice(0, 8) ?? [];
  const labelMix = useMemo(() => {
    const raw = (data?.semantic?.labelMix ?? []).map((l) => ({ name: l.label, value: l.count }));
    return topNBuckets(raw, 6);
  }, [data?.semantic?.labelMix]);
  const confBuckets = data?.semantic?.confidenceBuckets ?? [];
  const userServers = data?.regression?.userServers ?? [];

  return (
    <section aria-label="Infrastructure visuals">
      <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-4)' }}>
        Traffic from <code>history.db</code>
        {data?.meta?.dataSources?.semantic === 'semantic-audit-store' ? ' · semantic from live audit store' : ''}
        {data?.meta?.swarmSessionLive ? ' · regression from session swarm' : ''}
        {data?.instantLearning?.source ? ` · learning: ${data.instantLearning.source}` : ''}
        {' · '}{windowSubtitle}
      </p>

      {!data?.meta?.swarmSessionLive && data?.meta?.emptyReasons?.regression ? (
        <p className="text-sm text-muted mb-4">{data.meta.emptyReasons.regression}</p>
      ) : null}
      {error && !data?.traffic?.hasData ? (
        <p className="text-sm text-danger mb-4">{error}</p>
      ) : null}

      <WorkspaceSubNav tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'traffic' ? (
        <div className="grid grid-12">
          <div className="col-span-8">
            <ChartPanel
              title="Calls Over Time"
              subtitle={windowSubtitle}
              loading={loading && !data}
              empty={!hourly.some((h) => h.calls > 0)}
              emptyReason={trafficEmptyReason}
              meta={trafficMeta}
              sparse={trafficMeta?.sparse}
            >
              <BarChart data={hourly}>
                <CartesianGrid {...CHART_GRID} />
                <XAxis dataKey="label" {...CHART_AXIS} interval="preserveStartEnd" />
                <YAxis {...CHART_AXIS} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Legend />
                <Bar dataKey="passed" stackId="a" fill={CHART_SERIES.allow} name="Passed" />
                <Bar dataKey="blocked" stackId="a" fill={CHART_SERIES.block} name="Blocked" />
              </BarChart>
            </ChartPanel>
          </div>
          <div className="col-span-4">
            <ChartPanel
              title="Latency p50 by Server"
              subtitle="Milliseconds"
              empty={!servers.length}
              emptyReason={trafficEmptyReason}
              meta={trafficMeta}
            >
              <BarChart data={servers} layout="vertical">
                <CartesianGrid {...CHART_GRID} />
                <XAxis type="number" {...CHART_AXIS} />
                <YAxis type="category" dataKey="serverName" width={90} {...CHART_AXIS} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar dataKey="latencyP50Ms" fill={CHART_SERIES.accent} name="p50 ms" />
              </BarChart>
            </ChartPanel>
          </div>
          <div className="col-span-6">
            <ChartPanel title="Top Tools" empty={!tools.length} emptyReason={trafficEmptyReason} meta={trafficMeta}>
              <BarChart data={tools}>
                <CartesianGrid {...CHART_GRID} />
                <XAxis dataKey="tool" {...CHART_AXIS} interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis {...CHART_AXIS} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar dataKey="count" fill={CHART_SERIES.accent} name="Calls" />
              </BarChart>
            </ChartPanel>
          </div>
          <div className="col-span-6">
            <ChartPanel title="Block Rules" empty={!rules.length} emptyReason={trafficEmptyReason} meta={trafficMeta}>
              <BarChart data={rules} layout="vertical">
                <CartesianGrid {...CHART_GRID} />
                <XAxis type="number" {...CHART_AXIS} />
                <YAxis type="category" dataKey="plainEnglish" width={120} {...CHART_AXIS} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Blocks">
                  {rules.map((r) => (
                    <Cell key={r.rule} fill={ruleCategoryColor(classifyRule(r.rule))} />
                  ))}
                </Bar>
              </BarChart>
            </ChartPanel>
          </div>
        </div>
      ) : null}

      {tab === 'learning' ? (
        <>
          {!learningHasData && learningEmptyReason ? (
            <p className="text-sm text-muted mb-4">{learningEmptyReason}</p>
          ) : null}
          <div className="grid grid-12" key="learning-charts">
            <div className="col-span-8">
              <ChartPanel
                title={learningChartTitle(data?.instantLearning)}
                empty={!learningChartHasValues(learningSeries)}
                emptyReason={learningEmptyReason}
              >
                <BarChart data={learningSeries}>
                  <CartesianGrid {...CHART_GRID} />
                  <XAxis dataKey="label" {...CHART_AXIS} interval="preserveStartEnd" />
                  <YAxis {...CHART_AXIS} allowDecimals={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Bar dataKey="blocks" fill={CHART_SERIES.accent} name="Blocks" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartPanel>
            </div>
            <div className="col-span-4">
              <ChartPanel
                title={learningSource === 'history-db-fallback' ? 'Top block rules' : 'Rule:tool clusters'}
                empty={!ruleToolChartData.length}
                emptyReason={learningEmptyReason}
              >
                <BarChart data={ruleToolChartData} layout="vertical">
                  <CartesianGrid {...CHART_GRID} />
                  <XAxis type="number" {...CHART_AXIS} />
                  <YAxis type="category" dataKey="name" width={100} {...CHART_AXIS} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Bar dataKey="count" fill={CHART_SERIES.purple} name="Count" />
                </BarChart>
              </ChartPanel>
            </div>
          </div>
          <p className="text-sm text-muted mt-4">
            Events: {data?.instantLearning?.totalEvents ?? 0} · Queued suggestions:{' '}
            {data?.instantLearning?.queuedSuggestions ?? 0}
          </p>
        </>
      ) : null}

      {tab === 'semantic' ? (
        <div className="grid grid-12">
          {!data?.semantic?.hasData && data?.meta?.emptyReasons?.semantic ? (
            <div className="col-span-12">
              <p className="text-sm text-muted mb-4">{data.meta.emptyReasons.semantic}</p>
            </div>
          ) : null}
          <div className="col-span-8">
            <ChartPanel title="Confidence Buckets" empty={!confBuckets.length}>
              <BarChart data={confBuckets}>
                <CartesianGrid {...CHART_GRID} />
                <XAxis dataKey="bucket" {...CHART_AXIS} />
                <YAxis {...CHART_AXIS} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar dataKey="count" fill={CHART_SERIES.purple} name="Count" />
              </BarChart>
            </ChartPanel>
          </div>
          <div className="col-span-4">
            <ChartPanel title="Label Mix" empty={!labelMix.length} height={240}>
              <PieChart>
                <Pie data={labelMix} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={72} label={false}>
                  {labelMix.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              </PieChart>
            </ChartPanel>
          </div>
        </div>
      ) : null}

      {tab === 'regression' ? (
        <ChartPanel title="Your Server Probes" empty={!userServers.length}>
          <BarChart data={userServers}>
            <CartesianGrid {...CHART_GRID} />
            <XAxis dataKey="serverName" {...CHART_AXIS} />
            <YAxis {...CHART_AXIS} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Bar dataKey="toolCount" fill={CHART_SERIES.allow} name="Tools" />
          </BarChart>
        </ChartPanel>
      ) : null}
    </section>
  );
}
