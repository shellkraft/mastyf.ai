'use client';

import { useState } from 'react';
import type { AgenticView } from '@/lib/workspace-nav';
import { WorkspaceSubNav } from '../ui/WorkspaceSubNav';
import { DashboardWindowProvider } from '../dashboard/DashboardWindowContext';
import { DashboardWindowSelector } from '../dashboard/DashboardWindowContext';
import { AgenticActionProvider, AgenticToast } from '../agentic/AgenticActionContext';
import { AgenticOverviewPanel } from '../agentic/AgenticOverviewPanel';
import { AgenticTrustPanel } from '../agentic/AgenticTrustPanel';
import { AgenticThreatsPanel } from '../agentic/AgenticThreatsPanel';
import { AgenticPolicyPanel } from '../agentic/AgenticPolicyPanel';
import { AgenticOperationsPanel } from '../agentic/AgenticOperationsPanel';
import { AgenticAuditPanel } from '../agentic/AgenticAuditPanel';
import { AgenticToolsPanel } from '../agentic/AgenticToolsPanel';

const AGENTIC_TABS: Array<{ id: AgenticView; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'trust', label: 'Trust & Servers' },
  { id: 'threats', label: 'Threats & Defense' },
  { id: 'policy', label: 'Policy & Compliance' },
  { id: 'operations', label: 'Operations' },
  { id: 'audit', label: 'Audit & Decisions' },
  { id: 'tools', label: 'Admin Tools' },
];

type Props = {
  view?: AgenticView;
  onViewChange?: (view: AgenticView) => void;
  refreshKey?: number;
};

export function AgenticWorkspace({ view = 'overview', onViewChange, refreshKey = 0 }: Props) {
  const [tick, setTick] = useState(0);
  const reload = () => setTick((t) => t + 1);
  const effectiveRefresh = refreshKey + tick;

  return (
    <DashboardWindowProvider>
      <AgenticActionProvider onRefresh={reload}>
        <div className="agentic-workspace p-4">
          <AgenticToast />
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <WorkspaceSubNav
              tabs={AGENTIC_TABS}
              active={view}
              onChange={(v) => onViewChange?.(v as AgenticView)}
            />
            <DashboardWindowSelector />
          </div>
          {view === 'overview' && <AgenticOverviewPanel refreshKey={effectiveRefresh} />}
          {view === 'trust' && <AgenticTrustPanel refreshKey={effectiveRefresh} />}
          {view === 'threats' && <AgenticThreatsPanel refreshKey={effectiveRefresh} />}
          {view === 'policy' && <AgenticPolicyPanel refreshKey={effectiveRefresh} />}
          {view === 'operations' && <AgenticOperationsPanel refreshKey={effectiveRefresh} />}
          {view === 'audit' && <AgenticAuditPanel refreshKey={effectiveRefresh} />}
          {view === 'tools' && <AgenticToolsPanel />}
        </div>
      </AgenticActionProvider>
    </DashboardWindowProvider>
  );
}
