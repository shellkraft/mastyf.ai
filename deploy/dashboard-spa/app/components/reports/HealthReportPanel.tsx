'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  downloadMcpHealthReport,
  fetchMcpHealthReport,
  type McpHealthReportResponse,
} from '@/lib/mastyf-ai-api';
import { useCurrentWindowDays } from '../dashboard/DashboardWindowContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

type Props = {
  proxyOnline: boolean | null;
  onReportLoading?: (loading: boolean) => void;
};

function verdictTone(v?: string): 'success' | 'warn' | 'danger' | 'neutral' {
  if (v === 'healthy') return 'success';
  if (v === 'attention') return 'warn';
  if (v === 'critical') return 'danger';
  return 'neutral';
}

export function HealthReportPanel({ proxyOnline, onReportLoading }: Props) {
  const { windowParam } = useCurrentWindowDays();
  const [report, setReport] = useState<McpHealthReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useLlm, setUseLlm] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (proxyOnline === false) {
      setReport(null);
      setError('Connect the proxy to generate a live health report.');
      return;
    }
    setLoading(true);
    setError('');
    onReportLoading?.(true);
    try {
      const { report, error: apiError } = await fetchMcpHealthReport(windowParam, useLlm);
      if (!report) {
        setReport(null);
        setError(
          apiError
            || (proxyOnline === null
              ? 'Checking proxy connection…'
              : 'No report data — restart proxy after `pnpm build` with DASHBOARD_ENABLED=true.'),
        );
      } else {
        setReport(report);
        setError('');
      }
    } finally {
      setLoading(false);
      onReportLoading?.(false);
    }
  }, [windowParam, useLlm, proxyOnline, onReportLoading]);

  useEffect(() => {
    void load();
  }, [load]);

  const onDownload = async () => {
    setExporting(true);
    try {
      const res = await downloadMcpHealthReport(windowParam, useLlm);
      if (!res.ok) setError(res.error || 'Download failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card
      title="MCP server health report"
      subtitle="Plain-language analysis of performance, blocks, and server condition"
      actions={
        <div className="btn-row">
          <label className="hint" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={useLlm}
              onChange={(e) => setUseLlm(e.target.checked)}
            />
            Enhance with local LLM (Ollama)
          </label>
          <Button variant="secondary" size="sm" disabled={loading} onClick={() => void load()}>
            Refresh
          </Button>
          <Button variant="primary" size="sm" disabled={exporting || !report?.markdown} onClick={() => void onDownload()}>
            {exporting ? 'Downloading…' : 'Download .md'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            Print / PDF
          </Button>
        </div>
      }
    >
      {loading ? <p className="hint">Building report from proxy history…</p> : null}
      {error ? <p className="status status-error">{error}</p> : null}
      {report?.headline ? (
        <div className="briefing-hero" style={{ marginBottom: 0, padding: '16px 0 0', border: 'none', background: 'transparent' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Badge tone={verdictTone(report.verdict)}>{report.verdict?.toUpperCase()}</Badge>
            {report.source === 'llm' ? (
              <span className="hint">Narrative · {report.provider}{report.model ? ` · ${report.model}` : ''}</span>
            ) : (
              <span className="hint">Measured from history DB</span>
            )}
          </div>
          <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>{report.headline}</h2>
          {report.narrative ? <p className="briefing-hero-lead">{report.narrative}</p> : null}
          {report.executiveSummary?.length ? (
            <ul className="insight-callout-list" style={{ marginTop: 12 }}>
              {report.executiveSummary.map((b) => (
                <li key={b.slice(0, 40)}>{b}</li>
              ))}
            </ul>
          ) : null}
          {report.servers?.length ? (
            <div style={{ marginTop: 16 }}>
              <p className="hint" style={{ fontWeight: 600, marginBottom: 8 }}>Servers ({report.servers.length})</p>
              <ul className="insight-callout-list">
                {report.servers.slice(0, 6).map((s) => (
                  <li key={s.name}>
                    <strong>{s.name}</strong> — {s.summary}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
