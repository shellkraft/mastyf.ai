'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchSwarmLatest, fetchThreatLabCandidates } from '@/lib/mastyff-ai-api';

type IntelRow = { id: string; source: string; summary: string; severity?: string };

export function LiveThreatIntelPanel() {
  const [rows, setRows] = useState<IntelRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [latest, candidates] = await Promise.all([fetchSwarmLatest(), fetchThreatLabCandidates()]);
    const out: IntelRow[] = [];
    for (const f of latest?.findings ?? []) {
      out.push({
        id: `${f.source}-${f.summary}`.slice(0, 40),
        source: f.source,
        summary: f.summary,
        severity: f.severity,
      });
    }
    for (const c of candidates.slice(0, 20)) {
      out.push({
        id: c.id,
        source: c.provenance?.source ?? 'threat-lab',
        summary: `${c.attackClass} (${(c.confidence * 100).toFixed(0)}%)`,
        severity: c.reviewStatus === 'accepted' ? 'mitigated' : 'candidate',
      });
    }
    setRows(out);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="hint">Loading live threat intel from session swarm…</p>;
  if (rows.length === 0) {
    return (
      <p className="muted">
        No live intel for this session. Run Security Analysis or Threat Lab to populate findings.
      </p>
    );
  }

  return (
    <section>
      <p className="hint live-data-banner live-data-banner-ok">
        Live session data — swarm findings and Threat Lab candidates (not bundled demo JSON).
      </p>
      <div className="btn-row">
        <button type="button" className="secondary btn-sm" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Source</th>
            <th>Summary</th>
            <th>Severity</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.source}</td>
              <td>{r.summary}</td>
              <td>{r.severity ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
