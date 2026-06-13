'use client';

import { FlowPipelineStrip } from './FlowPipelineStrip';
import { FlowTimeline } from './FlowTimeline';
import { SwarmResultsView } from './SwarmResultsView';
import { SwarmRunControls } from './SwarmRunControls';
import type { DashboardWsState } from '@/lib/use-dashboard-ws';
import type { SwarmJobStatus } from '@/lib/mastyff-ai-api';

type Props = {
  ws: DashboardWsState;
  roles?: string[];
  swarmJobStatus?: SwarmJobStatus | null;
  onSwarmStatus?: (job: SwarmJobStatus | null) => void;
  onOpenThreats?: (view: string) => void;
};

export function AgentFlowPanel({
  ws,
  roles,
  swarmJobStatus,
  onSwarmStatus,
  onOpenThreats,
}: Props) {
  return (
    <section aria-label="Security analysis">
      <h2>Security analysis</h2>
      <p className="hint">
        Run the full pipeline (Preflight → Technical), watch live progress, and read the plain-English
        report. All data comes from your proxy session — no bundled demo metrics.
      </p>
      <p className={ws.statusIsError ? 'status status-error' : 'status'}>{ws.statusText}</p>

      <SwarmRunControls
        roles={roles}
        pipeline={ws.pipeline}
        onSwarmStatus={(job) => {
          ws.syncSwarmJobStatus(job);
          onSwarmStatus?.(job);
        }}
        showDownload
      />
      <FlowPipelineStrip pipeline={ws.pipeline} logTail={swarmJobStatus?.logTail} />
      {ws.pipeline.state === 'failed' ? (
        <p className="status status-error" role="alert">
          Last analysis failed
          {ws.pipeline.phaseLabel ? ` at ${ws.pipeline.phaseLabel}` : ''}
          {ws.pipeline.error ? `: ${ws.pipeline.error}` : ''}. See job log below or{' '}
          <code>reports/security-swarm/job.log</code>.
        </p>
      ) : null}

      <h3>Security report</h3>
      <SwarmResultsView
        refreshKey={
          ws.swarmDoneTick
          + ws.pipeline.progressPct
          + (ws.pipeline.state === 'done' ? 1000 : 0)
        }
        showReport
        className="swarm-results-flow"
        onOpenThreats={onOpenThreats}
      />

      <h3>Activity timeline</h3>
      <FlowTimeline entries={ws.entries} />
    </section>
  );
}
