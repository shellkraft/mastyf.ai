'use client';

import type { ThreatDiscoveryJobStatus } from '@/lib/mastyf-ai-api';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';

function jobBadgeVariant(
  state: ThreatDiscoveryJobStatus['state'],
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (state === 'done') return 'success';
  if (state === 'failed') return 'danger';
  if (state === 'running') return 'warning';
  return 'neutral';
}

function formatFinishedAt(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function JobRow({
  label,
  job,
  doneDetail,
}: {
  label: string;
  job: ThreatDiscoveryJobStatus | null;
  doneDetail?: string;
}) {
  if (!job || job.state === 'idle') {
    return (
      <div className="threat-job-row">
        <div className="threat-job-row-head">
          <span className="font-medium text-sm">{label}</span>
          <Badge variant="neutral">Idle</Badge>
        </div>
        <p className="text-xs text-muted">No recent run for this tenant.</p>
      </div>
    );
  }

  const logLine = job.logTail?.split('\n').filter(Boolean).slice(-1)[0] || '';

  return (
    <div className="threat-job-row">
      <div className="threat-job-row-head">
        <span className="font-medium text-sm">{label}</span>
        <Badge variant={jobBadgeVariant(job.state)}>
          {job.state === 'running' ? 'Running' : job.state}
        </Badge>
      </div>
      {job.state === 'running' ? (
        <>
          <p className="text-sm">
            {job.phaseLabel || job.phase || 'Working…'}
            {job.progressPct > 0 ? ` · ${job.progressPct}%` : ''}
          </p>
          <div className="threat-job-progress" aria-hidden>
            <div
              className="threat-job-progress-fill"
              style={{ width: `${Math.max(job.progressPct, 8)}%` }}
            />
          </div>
          {logLine ? (
            <pre className="threat-job-log text-xs text-muted">{logLine.slice(0, 240)}</pre>
          ) : (
            <p className="text-xs text-muted">LLM discovery in progress — this can take several minutes.</p>
          )}
        </>
      ) : null}
      {job.state === 'done' ? (
        <p className="text-sm text-muted">
          Finished {formatFinishedAt(job.finishedAt)}
          {doneDetail ? ` · ${doneDetail}` : ''}
        </p>
      ) : null}
      {job.state === 'failed' ? (
        <p className="text-sm" style={{ color: 'var(--danger)' }} role="alert">
          Failed{job.finishedAt ? ` at ${formatFinishedAt(job.finishedAt)}` : ''}
          {job.error ? `: ${job.error}` : ''}
        </p>
      ) : null}
    </div>
  );
}

type Props = {
  threatLabJob: ThreatDiscoveryJobStatus | null;
  autoResearchJob: ThreatDiscoveryJobStatus | null;
  threatLabDoneDetail?: string;
  autoResearchDoneDetail?: string;
  compact?: boolean;
};

export function ThreatDiscoveryJobStatus({
  threatLabJob,
  autoResearchJob,
  threatLabDoneDetail,
  autoResearchDoneDetail,
  compact = false,
}: Props) {
  const anyRunning =
    threatLabJob?.state === 'running' || autoResearchJob?.state === 'running';

  const body = (
    <div className="threat-job-status-grid">
      <JobRow label="Threat Lab" job={threatLabJob} doneDetail={threatLabDoneDetail} />
      <JobRow label="Auto Research" job={autoResearchJob} doneDetail={autoResearchDoneDetail} />
    </div>
  );

  if (compact) return body;

  return (
    <Card
      title="Discovery jobs"
      subtitle={anyRunning ? 'Running — status refreshes every 2s' : 'Latest tenant batch status'}
    >
      {body}
    </Card>
  );
}
