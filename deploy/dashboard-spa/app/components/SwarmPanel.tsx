'use client';

import { FlowPipelineStrip } from './FlowPipelineStrip';
import { SwarmResultsView } from './SwarmResultsView';
import { SwarmRunControls } from './SwarmRunControls';
import type { PipelineState } from '@/lib/flow-types';
import type { SwarmJobStatus } from '@/lib/mastyff-ai-api';

type Props = {
  roles?: string[];
  pipeline?: PipelineState;
  swarmDoneTick?: number;
  swarmJobStatus?: SwarmJobStatus | null;
  onSwarmStatus?: (job: SwarmJobStatus | null) => void;
  onOpenThreats?: (view: string) => void;
  onGoAnalysis?: () => void;
};

export function SwarmPanel({
  roles,
  pipeline,
  swarmDoneTick = 0,
  swarmJobStatus,
  onSwarmStatus,
  onOpenThreats,
  onGoAnalysis,
}: Props) {
  const resultsKey =
    swarmDoneTick + (pipeline?.state === 'done' ? 1000 : 0);

  return (
    <section aria-label="Security analysis results">
      <h2>Swarm results</h2>
      <p className="hint">
        Mirror of the latest session analysis.{' '}
        <button type="button" className="linkish" onClick={onGoAnalysis}>
          Run or watch pipeline in Activity → Security analysis
        </button>
        .
      </p>

      <SwarmRunControls
        roles={roles}
        pipeline={pipeline}
        onSwarmStatus={onSwarmStatus}
        showDownload
      />
      {pipeline ? <FlowPipelineStrip pipeline={pipeline} logTail={swarmJobStatus?.logTail} /> : null}

      <SwarmResultsView refreshKey={resultsKey} showReport className="swarm-results-tab" onOpenThreats={onOpenThreats} />
    </section>
  );
}
