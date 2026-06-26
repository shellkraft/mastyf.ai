'use client';

import { useState } from 'react';
import type { TribunalJobStatus, TribunalReport } from '@/lib/mastyf-ai-api';
import { TRIBUNAL_BATCH_LIMIT } from '@/lib/tribunal-config';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { EmptyState } from './ui/EmptyState';

type DebateArgument = {
  persona?: string;
  stance?: string;
  reasoning?: string;
  confidence?: number;
};

type TribunalVerdict = {
  recommendedLabel?: 'true_positive' | 'false_positive' | 'needs_review';
  unanimous?: boolean;
  confidence?: number;
  dissent?: string;
};

type TribunalDebate = {
  recordId?: string;
  toolName?: string;
  serverName?: string;
  uncertaintyScore?: number;
  arguments?: DebateArgument[];
  verdict?: TribunalVerdict;
  transcript?: string;
  generatedAt?: string;
  autoLabelEligible?: boolean;
};

const LABEL_COPY: Record<string, string> = {
  true_positive: 'True positive',
  false_positive: 'False positive',
  needs_review: 'Needs review',
};

const PERSONA_LABEL: Record<string, string> = {
  block_advocate: 'Block advocate',
  allow_advocate: 'Allow advocate',
  auditor: 'Auditor',
};

function formatLabel(label: string | undefined): string {
  if (!label) return 'Unknown';
  return LABEL_COPY[label] || label.replace(/_/g, ' ');
}

function verdictVariant(
  label: string | undefined,
): 'danger' | 'success' | 'warning' | 'neutral' {
  if (label === 'true_positive') return 'danger';
  if (label === 'false_positive') return 'success';
  if (label === 'needs_review') return 'warning';
  return 'neutral';
}

function jobBadgeVariant(state: TribunalJobStatus['state'] | undefined) {
  if (state === 'done') return 'success' as const;
  if (state === 'failed') return 'danger' as const;
  if (state === 'running') return 'warning' as const;
  return 'neutral' as const;
}

function formatTs(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

type Props = {
  tribunal: TribunalReport | null;
  job?: TribunalJobStatus | null;
  queue?: {
    eligibleTotal: number;
    remainingEligible: number;
    nextBatchSize: number;
    batchLimit: number;
  } | null;
  onRunTribunal?: () => void;
  tribunalLoading?: boolean;
  onInvestigateRecord?: (recordId: string) => void;
};

export function TribunalSummaryCard({
  tribunal,
  job,
  queue,
  onRunTribunal,
  tribunalLoading,
  onInvestigateRecord,
}: Props) {
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const debates = (tribunal?.debates as TribunalDebate[]) ?? [];
  const debatedCount = tribunal?.debatedCount ?? debates.length;
  const autoLabels = tribunal?.autoLabelsApplied ?? 0;
  const eligibleTotal = queue?.eligibleTotal ?? tribunal?.eligibleTotal ?? 0;
  const remainingEligible = queue?.remainingEligible ?? tribunal?.remainingEligible ?? 0;
  const generatedAt = tribunal?.generatedAt ?? null;
  const quorumMet = tribunal?.quorumMet === true;
  const hasPriorRun = debates.length > 0 || Boolean(generatedAt);
  const isRunning = tribunalLoading || job?.state === 'running';
  const noMoreRemaining = !isRunning && hasPriorRun && remainingEligible === 0 && eligibleTotal === 0;
  const runLabel = isRunning
    ? 'Running…'
    : hasPriorRun && remainingEligible > 0
      ? `Next batch (${TRIBUNAL_BATCH_LIMIT})`
      : `Run batch (${TRIBUNAL_BATCH_LIMIT})`;

  const runButton = onRunTribunal ? (
    <Button
      variant="primary"
      size="sm"
      disabled={isRunning || noMoreRemaining}
      loading={isRunning}
      onClick={onRunTribunal}
    >
      {runLabel}
    </Button>
  ) : null;

  return (
    <Card
      title="Semantic Tribunal"
      subtitle="Multi-agent debate on uncertain semantic flags"
      actions={runButton}
    >
      <div className="threat-job-row" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="threat-job-row-head">
          <span className="font-medium text-sm">Batch status</span>
          <Badge variant={jobBadgeVariant(job?.state)}>
            {isRunning ? 'Running' : job?.state || 'idle'}
          </Badge>
        </div>
        {isRunning ? (
          <>
            <p className="text-sm">
              {job?.phaseLabel || 'Debating uncertain semantic flags'}
              {job?.progressPct ? ` · ${job.progressPct}%` : ''}
            </p>
            <div className="threat-job-progress" aria-hidden>
              <div
                className="threat-job-progress-fill"
                style={{ width: `${Math.max(job?.progressPct ?? 8, 8)}%` }}
              />
            </div>
            {job?.logTail ? (
              <pre className="threat-job-log text-xs text-muted">
                {job.logTail.split('\n').slice(-1)[0]?.slice(0, 240)}
              </pre>
            ) : (
              <p className="text-xs text-muted">Processing up to {TRIBUNAL_BATCH_LIMIT} debates…</p>
            )}
          </>
        ) : job?.state === 'done' ? (
          <p className="text-sm text-muted">
            Finished {formatTs(job.finishedAt)}
            {job.debatedCount != null ? ` · ${job.debatedCount} debated` : ''}
            {job.remainingEligible != null ? ` · ${job.remainingEligible} remaining` : ''}
          </p>
        ) : job?.state === 'failed' ? (
          <p className="text-sm" style={{ color: 'var(--danger)' }} role="alert">
            Failed{job.finishedAt ? ` at ${formatTs(job.finishedAt)}` : ''}
            {job.error ? `: ${job.error}` : ''}
          </p>
        ) : (
          <p className="text-xs text-muted">
            {eligibleTotal > 0
              ? `${eligibleTotal} eligible · next batch up to ${queue?.nextBatchSize ?? TRIBUNAL_BATCH_LIMIT}`
              : 'No uncertain unlabeled flags in queue'}
          </p>
        )}
      </div>

      {noMoreRemaining ? (
        <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-3)' }}>
          Queue empty — route more borderline traffic through the proxy, then run another batch.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3 text-sm" style={{ marginBottom: 'var(--space-4)' }}>
        <span><span className="text-muted">Debated</span> <strong>{debatedCount}</strong></span>
        <span><span className="text-muted">Eligible</span> <strong>{eligibleTotal}</strong></span>
        <span><span className="text-muted">Remaining</span> <strong>{remainingEligible}</strong></span>
        {autoLabels > 0 ? (
          <span><span className="text-muted">Auto-labeled</span> <strong>{autoLabels}</strong></span>
        ) : null}
        {quorumMet ? <Badge variant="success">Quorum met</Badge> : null}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowHowItWorks((v) => !v)}
        style={{ marginBottom: 'var(--space-3)' }}
      >
        {showHowItWorks ? 'Hide how it works' : 'How does this work?'}
      </Button>

      {showHowItWorks ? (
        <div
          className="text-sm text-muted"
          style={{
            marginBottom: 'var(--space-4)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-muted)',
            lineHeight: 'var(--leading-relaxed)',
          }}
        >
          <p style={{ marginTop: 0 }}>
            Each batch debates up to {TRIBUNAL_BATCH_LIMIT} unlabeled semantic audits in the uncertain
            confidence band. Block, allow, and auditor personas recommend{' '}
            <code className="text-xs">true_positive</code>, <code className="text-xs">false_positive</code>,
            or <code className="text-xs">needs_review</code>.
          </p>
          <p style={{ marginBottom: 0 }}>
            Requires semantic async audits and MCP traffic routed through Mastyf AI.
          </p>
        </div>
      ) : null}

      {debates.length === 0 ? (
        <EmptyState
          title="No debates yet"
          message={
            eligibleTotal > 0
              ? `${eligibleTotal} eligible flag(s) in queue — run a batch to start.`
              : 'Generate semantic traffic or lower MASTYF_AI_SEMANTIC_MIN_CONFIDENCE to surface borderline flags.'
          }
        />
      ) : (
        <>
          <p className="text-xs text-muted" style={{ marginBottom: 'var(--space-3)' }}>
            Last run {generatedAt ? formatTs(generatedAt) : '—'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {debates.map((d) => {
              const id = String(d.recordId || d.toolName);
              const expanded = expandedId === id;
              const blockArg = d.arguments?.find((a) => a.persona === 'block_advocate');
              const allowArg = d.arguments?.find((a) => a.persona === 'allow_advocate');
              const subjectLine = [
                d.serverName,
                d.toolName,
                d.uncertaintyScore != null
                  ? `${(d.uncertaintyScore * 100).toFixed(0)}% uncertainty`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ');

              return (
                <div
                  key={id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-4)',
                  }}
                >
                  <div className="flex items-start justify-between gap-3" style={{ marginBottom: 'var(--space-2)' }}>
                    <div style={{ minWidth: 0 }}>
                      <p className="font-medium text-sm" style={{ margin: 0 }}>
                        {subjectLine || id}
                      </p>
                      <p className="text-xs text-muted" style={{ margin: '4px 0 0' }}>
                        Should this tool call be blocked as a threat?
                      </p>
                    </div>
                    <Badge variant={verdictVariant(d.verdict?.recommendedLabel)}>
                      {formatLabel(d.verdict?.recommendedLabel)}
                    </Badge>
                  </div>

                  <p className="text-sm text-muted" style={{ margin: '0 0 var(--space-3)' }}>
                    {formatLabel(d.verdict?.recommendedLabel)}
                    {d.verdict?.confidence != null
                      ? ` · ${(d.verdict.confidence * 100).toFixed(0)}% confidence`
                      : ''}
                    {d.verdict?.unanimous ? ' · unanimous' : ' · split'}
                    {d.autoLabelEligible ? ' · auto-label eligible' : ''}
                  </p>

                  {blockArg?.reasoning ? (
                    <p className="text-xs text-muted" style={{ margin: '0 0 var(--space-2)' }}>
                      <strong>Block:</strong> {blockArg.reasoning}
                    </p>
                  ) : null}
                  {allowArg?.reasoning ? (
                    <p className="text-xs text-muted" style={{ margin: '0 0 var(--space-3)' }}>
                      <strong>Allow:</strong> {allowArg.reasoning}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setExpandedId(expanded ? null : id)}
                    >
                      {expanded ? 'Hide arguments' : 'Show arguments'}
                    </Button>
                    {onInvestigateRecord && d.recordId ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onInvestigateRecord(d.recordId!)}
                      >
                        Investigate
                      </Button>
                    ) : null}
                  </div>

                  {expanded ? (
                    <div style={{ marginTop: 'var(--space-3)' }}>
                      {(d.arguments || []).map((arg) => (
                        <div
                          key={arg.persona}
                          className="text-sm"
                          style={{
                            marginBottom: 'var(--space-2)',
                            padding: 'var(--space-2)',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-muted)',
                          }}
                        >
                          <p className="font-medium" style={{ margin: '0 0 4px' }}>
                            {PERSONA_LABEL[arg.persona || ''] || arg.persona} ({arg.stance})
                            {arg.confidence != null
                              ? ` · ${(arg.confidence * 100).toFixed(0)}%`
                              : ''}
                          </p>
                          <p className="text-muted" style={{ margin: 0 }}>
                            {arg.reasoning || '—'}
                          </p>
                        </div>
                      ))}
                      {d.transcript ? (
                        <details style={{ marginTop: 'var(--space-2)' }}>
                          <summary className="text-xs text-muted" style={{ cursor: 'pointer' }}>
                            Raw transcript
                          </summary>
                          <pre
                            className="threat-job-log text-xs text-muted"
                            style={{ marginTop: 'var(--space-2)' }}
                          >
                            {d.transcript}
                          </pre>
                        </details>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}
