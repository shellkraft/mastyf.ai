'use client';

import type { AggregateMetrics, AuditResponse } from '@/lib/mastyff-ai-api';
import { ExecutiveOverviewPanel } from '../dashboard/ExecutiveOverviewPanel';
import { HealthReportPanel } from '../reports/HealthReportPanel';
import { SocEnterpriseReadinessPanel } from '../soc/SocEnterpriseReadinessPanel';

type Props = {
  refreshKey: number;
  metrics: AggregateMetrics | null | undefined;
  audit: AuditResponse | null;
  proxyOnline: boolean | null;
  onReportLoading?: (loading: boolean) => void;
};

export function HomeWorkspace({ refreshKey, metrics, audit, proxyOnline, onReportLoading }: Props) {
  const semanticFlags = audit?.flagged ?? audit?.semanticAudit?.flagged ?? 0;

  return (
    <>
      <section className="briefing-hero">
        <h2>Your MCP protection at a glance</h2>
        <p className="briefing-hero-lead">
          Measured metrics from the Mastyff AI proxy and a downloadable health report in plain language.
          Use Activity for live tool flow and Security for threats and policy.
        </p>
      </section>

      <HealthReportPanel proxyOnline={proxyOnline} onReportLoading={onReportLoading} />

      <ExecutiveOverviewPanel
        refreshKey={refreshKey}
        metrics={metrics ?? undefined}
        semanticFlags={semanticFlags}
      />

      <SocEnterpriseReadinessPanel />
    </>
  );
}
