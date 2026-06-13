'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchSwarmLiveSession, type LiveFilesystemSession } from '@/lib/mastyff-ai-api';

export function LiveAttackSimulationsPanel() {
  const [session, setSession] = useState<LiveFilesystemSession | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setSession(await fetchSwarmLiveSession());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="hint">Loading live filesystem MCP scenarios…</p>;
  if (!session?.summary && !(session?.proxyResults?.length)) {
    return (
      <p className="muted">
        No live MCP scenario results for this session. Run analysis from Activity → Analysis (Live MCP phase).
      </p>
    );
  }

  const s = session.summary;

  return (
    <section>
      <div className="btn-row">
        <button type="button" className="secondary btn-sm" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      {s ? (
        <div className="kpi-row">
          <div className="kpi-card">
            <span className="kpi-card-label">Scenarios</span>
            <p className="kpi-card-value">{s.scenariosRun}</p>
          </div>
          <div className="kpi-card kpi-card-success">
            <span className="kpi-card-label">Passed</span>
            <p className="kpi-card-value">{s.scenariosPassed}</p>
          </div>
          <div className="kpi-card kpi-card-warn">
            <span className="kpi-card-label">Failed</span>
            <p className="kpi-card-value">{s.scenariosFailed}</p>
          </div>
        </div>
      ) : null}
      {(session.proxyResults ?? []).length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Expected</th>
              <th>Actual</th>
              <th>Rule</th>
            </tr>
          </thead>
          <tbody>
            {session.proxyResults!.map((r) => (
              <tr key={r.scenario}>
                <td>{r.scenario}</td>
                <td>{r.expected}</td>
                <td className={r.ok ? 'gate-pass' : 'gate-fail'}>{r.actual}</td>
                <td>{r.rule ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
