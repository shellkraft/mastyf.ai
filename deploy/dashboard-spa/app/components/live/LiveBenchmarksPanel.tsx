'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchSwarmLatest } from '@/lib/mastyff-ai-api';

type BenchRow = { name: string; p50?: number; p95?: number; sloMs?: number; sloPass?: boolean };

export function LiveBenchmarksPanel() {
  const [rows, setRows] = useState<BenchRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const latest = await fetchSwarmLatest();
    const raw = latest as Record<string, unknown> | null;
    const perf = (raw?.performance as { tiers?: BenchRow[] } | undefined)?.tiers
      ?? (raw?.benchmarks as BenchRow[] | undefined)
      ?? [];
    setRows(Array.isArray(perf) ? perf : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="hint">Loading benchmarks from last session swarm…</p>;
  if (rows.length === 0) {
    return (
      <p className="muted">
        No benchmark data for this session. Run Security Analysis from Activity → Analysis (includes swarm gates).
      </p>
    );
  }

  return (
    <section>
      <div className="btn-row">
        <button type="button" className="secondary btn-sm" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Tier</th>
            <th>p50</th>
            <th>p95</th>
            <th>SLO</th>
            <th>Pass</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.name}>
              <td>{t.name}</td>
              <td>{t.p50 != null ? `${Math.round(t.p50)}ms` : '—'}</td>
              <td>{t.p95 != null ? `${Math.round(t.p95)}ms` : '—'}</td>
              <td>{t.sloMs != null ? `${t.sloMs}ms` : '—'}</td>
              <td className={t.sloPass ? 'gate-pass' : 'gate-fail'}>
                {t.sloPass == null ? '—' : t.sloPass ? 'PASS' : 'FAIL'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
