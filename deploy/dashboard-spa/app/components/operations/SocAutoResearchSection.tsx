'use client';

import { useMemo } from 'react';
import type { AutoCorpusEntry, ThreatDiscoveryStatus } from '@/lib/mastyf-ai-api';
import { SOURCE_LABELS } from '@/lib/threat-discovery-copy';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { KpiCard } from '../ui/KpiCard';
import { EmptyState } from '../ui/EmptyState';

type Props = {
  entries: AutoCorpusEntry[];
  status: ThreatDiscoveryStatus | null;
};

function countLast24h(entries: AutoCorpusEntry[]): number {
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  return entries.filter((e) => Date.parse(e.timestamp) >= dayAgo).length;
}

export function SocAutoResearchSection({ entries, status }: Props) {
  const pipeline = status?.pipeline;
  const parsed = status?.jobs?.autoResearch?.parsed;
  const autoJob = status?.jobs?.autoResearch;
  const corpusTotal = status?.autoCorpus.stats.total || entries.length;
  const corpusLast24h = status?.autoCorpus.stats.last24h || countLast24h(entries);
  const ratePct = pipeline && pipeline.maxPerHour > 0
    ? Math.round((pipeline.writesThisHour / pipeline.maxPerHour) * 100)
    : 0;

  const lastBatchHadSkips =
    parsed != null && parsed.attempted > 0 && parsed.written === 0;
  const skipParts = parsed
    ? [
        parsed.skips.duplicate > 0 ? `${parsed.skips.duplicate} duplicate` : null,
        parsed.skips.belowMinConfidence > 0 ? `${parsed.skips.belowMinConfidence} low confidence` : null,
        parsed.skips.replayFailed > 0 ? `${parsed.skips.replayFailed} replay failed` : null,
        parsed.skips.llmUnavailable > 0 ? `${parsed.skips.llmUnavailable} LLM unavailable` : null,
        parsed.skips.other > 0 ? `${parsed.skips.other} other` : null,
      ].filter(Boolean)
    : [];

  const emptyMessage = lastBatchHadSkips
    ? `Last batch wrote 0/${parsed!.attempted} fixtures${skipParts.length ? ` — ${skipParts.join(', ')}` : ''}. Historical corpus entries remain listed below.`
    : autoJob?.state === 'running'
      ? 'Auto Research in progress — corpus table updates when the job completes.'
      : autoJob?.state === 'done' && parsed?.written === 0 && (parsed?.attempted ?? 0) > 0
        ? 'Last run completed with no new fixtures — signals were already processed or rejected by safety gates.'
        : corpusTotal > 0
          ? undefined
          : status?.provenance?.sessionActive === false
            ? 'No corpus fixtures yet — run Auto Research to generate LLM-validated attack fixtures.'
            : 'Run Auto Research to generate LLM-validated attack fixtures';

  const tableEntries = useMemo(
    () => [...entries].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)),
    [entries],
  );

  return (
    <>
      <div className="kpi-grid" style={{ marginBottom: 'var(--space-5)' }}>
        <KpiCard label="Auto Corpus Total" value={corpusTotal} accent="info" />
        <KpiCard label="Last 24h" value={corpusLast24h} accent="success" />
        <KpiCard label="Pipeline Rate" value={`${ratePct}%`} accent={ratePct > 80 ? 'warning' : 'neutral'} />
        <KpiCard
          label="Last Batch"
          value={parsed ? `${parsed.written}/${parsed.attempted}` : '—'}
          accent="neutral"
        />
      </div>

      <Card title="Auto Corpus Fixtures" subtitle="LLM-validated attack fixtures from Auto Research">
        {tableEntries.length === 0 ? (
          <EmptyState
            title={autoJob?.state === 'running' ? 'Job running' : 'No fixtures'}
            message={emptyMessage || 'No corpus entries in the current tenant batch.'}
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Source</th>
                  <th>Attack class</th>
                  <th>Confidence</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {tableEntries.map((e) => (
                  <tr key={e.advId}>
                    <td><code className="text-xs">{e.advId}</code></td>
                    <td>{SOURCE_LABELS[e.source] || e.source}</td>
                    <td className="text-sm">{e.attackClass}</td>
                    <td>{(e.confidence * 100).toFixed(0)}%</td>
                    <td className="text-xs">{new Date(e.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {status?.autoCorpus.manifest?.timestamp ? (
          <p className="text-xs text-muted" style={{ marginTop: 'var(--space-3)' }}>
            Manifest updated {new Date(status.autoCorpus.manifest.timestamp).toLocaleString()}
          </p>
        ) : null}
      </Card>
    </>
  );
}
