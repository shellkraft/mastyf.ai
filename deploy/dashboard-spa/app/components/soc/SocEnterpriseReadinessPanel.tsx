'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, Lock, Server, Shield } from 'lucide-react';
import {
  fetchAggregateMetrics,
  fetchHealth,
  fetchPolicy,
  type AggregateMetrics,
  type HealthResponse,
  type PolicyInfo,
} from '@/lib/mastyff-ai-api';
import { formatUsd } from '@/lib/chartTheme';
import { SocCard, SocSectionHeader } from './primitives';

function fmtMs(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value)}ms`;
}

function fmtPct(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

export function SocEnterpriseReadinessPanel() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [liveMetrics, setLiveMetrics] = useState<AggregateMetrics | null>(null);
  const [policy, setPolicy] = useState<PolicyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [h, m, p] = await Promise.all([
        fetchHealth(),
        fetchAggregateMetrics(7),
        fetchPolicy(),
      ]);
      setHealth(h);
      setLiveMetrics(m);
      setPolicy(p);
      setLastFetch(new Date().toTimeString().slice(0, 8));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const scoreColor = (rate: number | null) =>
    rate == null ? 'var(--text-muted)' : rate >= 90 ? 'var(--green)' : rate >= 70 ? 'var(--amber)' : 'var(--red)';

  const cbColor = (cb: string) =>
    cb === 'CLOSED' ? 'var(--green)' : cb === 'HALF_OPEN' ? 'var(--amber)' : 'var(--red)';

  const blockRate =
    liveMetrics && liveMetrics.totalRequests > 0
      ? Math.round((liveMetrics.blockedRequests / liveMetrics.totalRequests) * 100)
      : null;

  const serverReports = health?.serverReports ?? [];
  const avgLatency = health?.avgLatencyMs ?? health?.avgLatency ?? null;
  const protectedCount = serverReports.filter(
    (s) => s.successRate != null && s.successRate > 0,
  ).length;

  return (
    <div>
      <div className="section-header mb-20">
        <Shield size={20} color="var(--accent)" />
        <div>
          <div className="section-title">Your MCP Protection Status</div>
          <div className="section-sub">
            Live data from Mastyff AI — what&apos;s protected, what&apos;s blocked, and how your servers are doing
            {lastFetch && ` · Updated ${lastFetch}`}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void fetchAll()}
          disabled={loading}
          className="secondary btn-sm"
          style={{ marginLeft: 'auto' }}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="kpi-grid mb-16">
        <div className="kpi-card kpi-cyan">
          <div className="kpi-label">Protected Servers</div>
          <div className="kpi-value kpi-cyan">
            {health ? `${protectedCount}/${serverReports.length}` : '—'}
          </div>
          <div className="kpi-delta pos">
            {health ? `${health.totalTools ?? 0} tools guarded` : 'Loading…'}
          </div>
        </div>
        <div className="kpi-card kpi-red">
          <div className="kpi-label">Requests Blocked (7d)</div>
          <div className="kpi-value kpi-red">
            {liveMetrics ? liveMetrics.blockedRequests.toLocaleString() : '—'}
          </div>
          <div className="kpi-delta pos">{blockRate !== null ? `${blockRate}% block rate` : 'No traffic yet'}</div>
        </div>
        <div className="kpi-card kpi-green">
          <div className="kpi-label">Requests Allowed (7d)</div>
          <div className="kpi-value kpi-green">
            {liveMetrics ? liveMetrics.passedRequests.toLocaleString() : '—'}
          </div>
          <div className="kpi-delta pos">
            {liveMetrics && liveMetrics.passRate != null
              ? `${fmtPct(liveMetrics.passRate, 1)} pass rate`
              : liveMetrics
                ? 'No pass rate yet'
                : ''}
          </div>
        </div>
        <div className="kpi-card kpi-blue">
          <div className="kpi-label">Avg Proxy Latency</div>
          <div className="kpi-value" style={{ color: 'var(--accent)' }}>
            {fmtMs(avgLatency)}
          </div>
          <div className="kpi-delta pos">health probe avg</div>
        </div>
        <div className="kpi-card kpi-amber">
          <div className="kpi-label">Total Cost (7d)</div>
          <div className="kpi-value kpi-amber">
            {liveMetrics && Number.isFinite(liveMetrics.totalCost)
              ? formatUsd(liveMetrics.totalCost)
              : '—'}
          </div>
          <div className="kpi-delta" style={{ color: 'var(--text-muted)' }}>
            tracked by MastyffAi
          </div>
        </div>
        <div className="kpi-card kpi-green">
          <div className="kpi-label">Policy</div>
          <div className="kpi-value kpi-green" style={{ fontSize: 16, paddingTop: 4 }}>
            {policy ? policy.mode.toUpperCase() : '—'}
          </div>
          <div className="kpi-delta pos">{policy ? policy.rules : 'Loading…'}</div>
        </div>
      </div>

      {health && serverReports.length > 0 && (
        <SocCard
          title="Your MCP Servers — Live Status"
          icon={<Server size={14} />}
          sub={`${serverReports.length} servers · Overall: ${health.overallStatus ?? 'unknown'}`}
          style={{ marginBottom: 16 }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))',
              gap: 12,
              marginTop: 8,
            }}
          >
            {serverReports.map((srv) => {
              const rate = srv.successRate;
              const ok = rate != null && rate >= 90;
              const warn = rate != null && rate > 0 && rate < 90;
              return (
                <div
                  key={srv.name}
                  style={{
                    borderRadius: 8,
                    padding: '14px 16px',
                    border: `1px solid ${ok ? 'rgba(34,197,94,0.25)' : warn ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)'}`,
                    background: ok
                      ? 'rgba(34,197,94,0.04)'
                      : warn
                        ? 'rgba(245,158,11,0.04)'
                        : 'rgba(239,68,68,0.04)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        flexShrink: 0,
                        display: 'inline-block',
                        background: ok ? 'var(--success)' : warn ? 'var(--warning)' : 'var(--danger)',
                      }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{srv.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase' }}>
                        Latency
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>
                        {Number.isFinite(srv.latency) ? `${srv.latency.toLocaleString()}ms` : '—'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase' }}>
                        Tools
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                        {(srv as { tools?: number }).tools ?? '—'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase' }}>
                        Circuit
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: cbColor(srv.circuitBreaker) }}>
                        {srv.circuitBreaker}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase' }}>
                        Success
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: scoreColor(rate) }}>
                        {fmtPct(rate, 0)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {(health.atRisk?.length ?? 0) > 0 && (
            <div
              style={{
                marginTop: 12,
                padding: '9px 14px',
                borderRadius: 7,
                border: '1px solid rgba(245,158,11,0.3)',
                background: 'rgba(245,158,11,0.06)',
                fontSize: 12,
                color: 'var(--warning)',
              }}
            >
              Servers needing attention: {health.atRisk!.join(', ')}
            </div>
          )}
        </SocCard>
      )}

      {policy && (
        <SocCard
          title="What Mastyff AI Is Blocking For You"
          icon={<Lock size={14} />}
          sub={`Policy: ${policy.mode} mode · ${policy.rules}`}
          style={{ marginBottom: 16 }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))',
              gap: 10,
              marginTop: 8,
            }}
          >
            {[
              { label: 'Shell commands', detail: 'bash, exec, curl, rm -rf', color: 'var(--danger)' },
              { label: 'Path traversal', detail: '/etc/, ~/.ssh/, .env, k8s secrets', color: 'var(--danger)' },
              { label: 'SQL injection', detail: 'DROP TABLE, UNION SELECT', color: 'var(--warning)' },
              { label: 'SSRF / cloud metadata', detail: '169.254.x.x, localhost', color: 'var(--warning)' },
              { label: 'Rate limits', detail: '120/min per tool, burst caps', color: 'var(--accent)' },
              { label: 'Token budgets', detail: 'Max input tokens per call', color: 'var(--accent)' },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  padding: '10px 12px',
                  borderRadius: 7,
                  border: `1px solid ${item.color}25`,
                  background: `${item.color}08`,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: item.color, marginBottom: 4 }}>
                  ✓ {item.label}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>{item.detail}</div>
              </div>
            ))}
          </div>
        </SocCard>
      )}

      {liveMetrics && liveMetrics.totalRequests === 0 && (
        <div
          style={{
            padding: 20,
            borderRadius: 8,
            border: '1px solid var(--border)',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 13,
          }}
        >
          No proxy traffic recorded yet in the last 7 days. Once your AI agent makes tool calls through Mastyff AI,
          you&apos;ll see real block/pass data here.
        </div>
      )}

      {liveMetrics && liveMetrics.totalRequests > 0 && (
        <SocCard title="Traffic Summary (Last 7 Days)" icon={<Activity size={14} />}>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', padding: '8px 0' }}>
            {[
              { l: 'Total requests', v: liveMetrics.totalRequests.toLocaleString(), c: 'var(--text-primary)' },
              { l: 'Blocked by MastyffAi', v: liveMetrics.blockedRequests.toLocaleString(), c: 'var(--danger)' },
              { l: 'Allowed through', v: liveMetrics.passedRequests.toLocaleString(), c: 'var(--success)' },
              { l: 'Block rate', v: blockRate !== null ? `${blockRate}%` : '—', c: 'var(--accent)' },
              { l: 'Avg latency added', v: fmtMs(liveMetrics.avgLatencyMs), c: 'var(--warning)' },
              {
                l: 'Cost tracked',
                v: Number.isFinite(liveMetrics.totalCost) ? formatUsd(liveMetrics.totalCost) : '—',
                c: 'var(--accent)',
              },
            ].map((m) => (
              <div key={m.l}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>
                  {m.l}
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, color: m.c }}>{m.v}</div>
              </div>
            ))}
          </div>
        </SocCard>
      )}
    </div>
  );
}
