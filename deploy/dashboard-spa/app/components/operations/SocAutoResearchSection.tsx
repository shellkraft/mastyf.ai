'use client';

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

export function SocAutoResearchSection({ entries, status }: Props) {
  const pipeline = status?.pipeline;
  const parsed = status?.jobs?.autoResearch?.parsed;
  const ratePct = pipeline && pipeline.maxPerHour > 0
    ? Math.round((pipeline.writesThisHour / pipeline.maxPerHour) * 100)
    : 0;

  return (
    <>
      <div className="kpi-grid" style={{ marginBottom: 'var(--space-5)' }}>
        <KpiCard label="Auto Corpus Total" value={status?.autoCorpus.stats.total ?? 0} accent="info" />
        <KpiCard label="Last 24h" value={status?.autoCorpus.stats.last24h ?? 0} accent="success" />
        <KpiCard label="Hourly Cap Used" value={`${ratePct}%`} accent={ratePct > 80 ? 'warning' : 'neutral'} />
        <KpiCard
          label="Last Batch"
          value={parsed ? `${parsed.written}/${parsed.attempted}` : '—'}
          accent={parsed && parsed.written === 0 && parsed.attempted > 0 ? 'warning' : 'neutral'}
        />
      </div>

      {!status?.llm.ok ? (
        <div className="banner banner-warning" style={{ marginBottom: 'var(--space-5)' }}>
          <div className="banner-content">
            LLM unavailable — auto-fixtures require Ollama. {status?.llm.reason || ''}
          </div>
        </div>
      ) : null}

      {!status?.features.autoResearchEnabled ? (
        <div className="banner banner-info" style={{ marginBottom: 'var(--space-5)' }}>
          <div className="banner-content">
            Auto research disabled on proxy — use Run Auto Research from Quick Actions or enable MASTYF_AI_THREAT_RESEARCH_AUTO.
          </div>
        </div>
      ) : null}

      <Card
        title="Auto Corpus Fixtures"
        subtitle="Read-only audit — policy is never auto-applied from this pipeline"
      >
        {entries.length === 0 ? (
          <EmptyState title="No fixtures" message="Run Auto Research to generate LLM-validated attack fixtures" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Fixture</th>
                  <th>Tool</th>
                  <th>Source</th>
                  <th>Confidence</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.advId}>
                    <td>
                      <code className="text-xs">{e.advId}</code>
                      <div className="text-xs text-muted">{e.relPath}</div>
                    </td>
                    <td className="text-sm">{e.toolName || '—'}</td>
                    <td className="text-sm">{SOURCE_LABELS[e.source] || e.source}</td>
                    <td><Badge variant={e.confidence >= 0.7 ? 'danger' : 'warning'}>{(e.confidence * 100).toFixed(0)}%</Badge></td>
                    <td className="text-xs">{new Date(e.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
