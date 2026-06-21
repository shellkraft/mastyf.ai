'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  buildMutatingHeaders,
  fetchThreatAutomationSummary,
  mastyfAiFetch,
  type ThreatAutomationSummary,
} from '@/lib/mastyf-ai-api';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { KpiCard } from '../ui/KpiCard';
import { EmptyState } from '../ui/EmptyState';

function formatTs(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function jobVariant(state: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (state === 'done') return 'success';
  if (state === 'failed') return 'danger';
  if (state === 'running') return 'warning';
  return 'neutral';
}

type Props = {
  refreshKey?: number;
  onAction?: (msg: string) => void;
};

export function SocAutomationSection({ refreshKey = 0, onAction }: Props) {
  const [state, setState] = useState<ThreatAutomationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { status, error: loadError } = await fetchThreatAutomationSummary();
    if (!status) {
      setError(loadError || 'Failed to load automation summary');
      setState(null);
    } else {
      setState(status);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load, refreshKey]);
  useEffect(() => {
    const t = window.setInterval(() => void load(), 10_000);
    return () => window.clearInterval(t);
  }, [load]);

  const startScheduler = async () => {
    setBusy('start');
    try {
      const headers = await buildMutatingHeaders();
      await mastyfAiFetch('/api/threat-discovery/scheduler/start', { method: 'POST', headers });
      onAction?.('Scheduler started');
    } catch {
      onAction?.('Could not start scheduler');
    }
    setBusy('');
    void load();
  };

  const stopScheduler = async () => {
    setBusy('stop');
    try {
      const headers = await buildMutatingHeaders();
      await mastyfAiFetch('/api/threat-discovery/scheduler/stop', { method: 'POST', headers });
      onAction?.('Scheduler stopped');
    } catch {
      onAction?.('Could not stop scheduler');
    }
    setBusy('');
    void load();
  };

  if (loading && !state) {
    return <p className="text-sm text-muted">Loading automation…</p>;
  }

  if (error) {
    return (
      <div className="banner banner-warning">
        <div className="banner-content">{error}</div>
      </div>
    );
  }

  if (!state) return null;

  const { scheduler, pipeline, promotion } = state;
  const autoResearch = state.jobs.autoResearch;
  const threatLab = state.jobs.threatLab;
  const writes24h = state.learning.counts24h.threat_research_write || 0;

  return (
    <>
      <div className="kpi-grid" style={{ marginBottom: 'var(--space-5)' }}>
        <KpiCard label="Corpus Fixtures" value={state.autoCorpus.total} accent="info" />
        <KpiCard label="Corpus (24h)" value={state.autoCorpus.last24h} accent="success" />
        <KpiCard label="Pending Review" value={`${state.threatLab.pending}/${state.threatLab.total}`} accent="warning" />
        <KpiCard label="Writes (24h)" value={writes24h} accent="neutral" />
      </div>

      <div className="grid grid-12" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="col-span-6">
          <Card title="Discovery Scheduler" subtitle="Automated Threat Lab and Auto Research cycles">
            <div className="flex items-center gap-3 text-sm" style={{ marginBottom: 'var(--space-4)' }}>
              <span className="text-muted">Status</span>
              <Badge variant={scheduler.running ? 'success' : 'neutral'}>{scheduler.running ? 'Running' : 'Stopped'}</Badge>
              <span className="text-muted">Last run</span>
              <span>{formatTs(scheduler.lastRunAt)}</span>
              {scheduler.lastRunStatus ? (
                <Badge variant={scheduler.lastRunStatus === 'success' ? 'success' : 'danger'}>{scheduler.lastRunStatus}</Badge>
              ) : null}
              <span className="text-muted">{scheduler.totalRuns} total runs</span>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" size="sm" disabled={scheduler.running || !!busy} onClick={() => void startScheduler()}>
                Start
              </Button>
              <Button variant="secondary" size="sm" disabled={!scheduler.running || !!busy} onClick={() => void stopScheduler()}>
                Stop
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void load()}>Refresh</Button>
            </div>
          </Card>
        </div>
        <div className="col-span-6">
          <Card title="Live Pipeline" subtitle="In-memory queue — resets on proxy restart">
            <div className="flex flex-wrap gap-4 text-sm">
              <div><span className="text-muted">Queued</span> <strong>{pipeline.queued}</strong></div>
              <div><span className="text-muted">Writes/hr</span> <strong>{pipeline.writesThisHour}/{pipeline.maxPerHour}</strong></div>
              <div><span className="text-muted">Pipeline</span> <Badge variant={pipeline.enabled ? 'success' : 'danger'}>{pipeline.enabled ? 'Enabled' : 'Disabled'}</Badge></div>
              <div><span className="text-muted">LLM</span> <Badge variant={state.llm.ok ? 'success' : 'danger'}>{state.llm.ok ? 'Connected' : 'Offline'}</Badge></div>
            </div>
            <p className="text-xs text-muted" style={{ marginTop: 'var(--space-3)' }}>
              Sources: {Object.entries(pipeline.sources).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none'}
              · Fingerprints processed: {state.processedFingerprints}
            </p>
          </Card>
        </div>
      </div>

      <div className="grid grid-12" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="col-span-6">
          <Card title="Last Auto Research Run">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={jobVariant(autoResearch.state)}>{autoResearch.state}</Badge>
              <span className="text-xs text-muted">Finished {formatTs(autoResearch.finishedAt)}</span>
            </div>
            <p className="text-sm">
              {autoResearch.parsed.written}/{autoResearch.parsed.attempted} fixtures written
              · duplicate skips {autoResearch.parsed.skips.duplicate}
            </p>
          </Card>
        </div>
        <div className="col-span-6">
          <Card title="Last Threat Lab Run">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={jobVariant(threatLab.state)}>{threatLab.state}</Badge>
              <span className="text-xs text-muted">Finished {formatTs(threatLab.finishedAt)}</span>
            </div>
            <p className="text-sm">Authentic candidates written: {threatLab.parsed.wroteAuthentic ?? 0}</p>
          </Card>
        </div>
      </div>

      <Card title="Corpus Promotion" subtitle="Auto-discovered threats promoted to regression corpus">
        <div className="flex flex-wrap gap-4 text-sm">
          <div><span className="text-muted">Promoted</span> <strong>{promotion.totalPromoted}</strong></div>
          <div><span className="text-muted">Daily quota</span> <strong>{promotion.dailyQuota.used}/{promotion.dailyQuota.max}</strong></div>
          <Badge variant={promotion.enabled ? 'success' : 'warning'}>{promotion.enabled ? 'Enabled' : 'Disabled'}</Badge>
        </div>
      </Card>

      <div className="section">
        <Card title="Learning Feed" subtitle="Recent discovery events">
          {state.learning.recent.length === 0 ? (
            <EmptyState title="No events" message="Learning events appear after discovery pipeline activity" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {state.learning.recent.map(event => (
                    <tr key={`${event.timestamp}-${event.type}`}>
                      <td className="text-xs">{new Date(event.timestamp).toLocaleTimeString()}</td>
                      <td><Badge variant="info">{event.type}</Badge></td>
                      <td className="text-sm">{event.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
