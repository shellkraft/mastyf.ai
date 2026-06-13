'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchComplianceReport } from '@/lib/mastyff-ai-api';
import { useDashboardWindow } from '../dashboard/DashboardWindowContext';

export function LiveCompliancePanel() {
  const { windowDays } = useDashboardWindow();
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchComplianceReport(windowDays);
    setReport(data);
    setLoading(false);
  }, [windowDays]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="hint">Loading compliance report from proxy…</p>;
  if (!report) {
    return (
      <p className="muted">
        Compliance report unavailable. Enable Enterprise AI features and ensure history DB has traffic.
      </p>
    );
  }

  const frameworks = (report.frameworks as Array<Record<string, unknown>>) ?? [];
  const summary = String(report.summary ?? report.headline ?? '');

  return (
    <section>
      <div className="btn-row">
        <button type="button" className="secondary btn-sm" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      {summary ? <p className="briefing-hero-lead">{summary}</p> : null}
      {frameworks.length === 0 ? (
        <pre className="code-block" style={{ fontSize: 12 }}>
          {JSON.stringify(report, null, 2).slice(0, 4000)}
        </pre>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Framework</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {frameworks.map((f, i) => (
              <tr key={String(f.id ?? i)}>
                <td>{String(f.name ?? f.id ?? '—')}</td>
                <td>{String(f.status ?? '—')}</td>
                <td>{String(f.notes ?? f.detail ?? '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
