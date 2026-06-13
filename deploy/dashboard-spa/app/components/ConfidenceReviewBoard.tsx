'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ThreatLabCandidate } from '@/lib/mastyff-ai-api';
import { CHART_AXIS, CHART_GRID, CHART_SERIES } from '@/lib/chartTheme';
import { ChartTooltip } from './dashboard/chart-kit';

const DEFAULT_THRESHOLD = 0.85;

type Props = {
  candidates: ThreatLabCandidate[];
  threshold?: number;
};

export function ConfidenceReviewBoard({ candidates, threshold = DEFAULT_THRESHOLD }: Props) {
  const pending = candidates.filter((c) => !c.reviewStatus || c.reviewStatus === 'pending');
  const high = pending.filter((c) => (c.confidence ?? 0) >= threshold);
  const review = pending.filter((c) => (c.confidence ?? 0) < threshold);

  const chartData = [
    { name: `≥${Math.round(threshold * 100)}% (auto-corpus track)`, value: high.length },
    { name: `<${Math.round(threshold * 100)}% (human review)`, value: review.length },
    { name: 'Accepted', value: candidates.filter((c) => c.reviewStatus === 'accepted').length },
    { name: 'Rejected', value: candidates.filter((c) => c.reviewStatus === 'rejected').length },
  ].filter((d) => d.value > 0);

  return (
    <div className="confidence-review-board">
      <section className="confidence-review-section">
        <h4>Auto-corpus track (≥{Math.round(threshold * 100)}% confidence)</h4>
        <p className="hint">
          High-confidence findings are written to the adversarial corpus by Auto Threat Research after
          validation. Policy is not auto-applied — review fixtures in Auto Research.
        </p>
        {high.length === 0 ? (
          <p className="muted">No pending high-confidence Threat Lab candidates.</p>
        ) : (
          <ul className="insight-callout-list">
            {high.slice(0, 5).map((c) => (
              <li key={c.id}>
                <strong>{c.id}</strong> — {(c.confidence * 100).toFixed(0)}% · {c.attackClass.slice(0, 48)}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="confidence-review-section">
        <h4>Human review queue (&lt;{Math.round(threshold * 100)}% or pending)</h4>
        <p className="hint">
          Accept applies a blocking policy rule to live policy. Reject discards the candidate. Use
          Investigate for kill-chain narrative before deciding.
        </p>
        {review.length === 0 ? (
          <p className="muted">No candidates awaiting human review.</p>
        ) : (
          <p className="hint">{review.length} candidate(s) in Threat Lab workbench below.</p>
        )}
      </section>
      {chartData.length > 0 ? (
        <div className="infra-chart-card" style={{ gridColumn: '1 / -1' }}>
          <h5>Review status distribution</h5>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid {...CHART_GRID} />
              <XAxis dataKey="name" {...CHART_AXIS} interval={0} angle={-12} textAnchor="end" height={60} />
              <YAxis {...CHART_AXIS} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" fill={CHART_SERIES.accent} name="Count" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  );
}
