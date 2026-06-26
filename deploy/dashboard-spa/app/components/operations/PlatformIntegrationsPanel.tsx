'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchAutopilotStatus,
  fetchLatestDigest,
  fetchOnboardingStatus,
  generateDigestNow,
  type AutopilotStatus,
  type OnboardingStatus,
} from '@/lib/mastyf-ai-api';
import { hasPermission } from '@/lib/dashboard-roles';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { KpiCard } from '../ui/KpiCard';
import { EmptyState } from '../ui/EmptyState';

type Props = {
  roles?: string[];
  refreshKey?: number;
  onAction?: (msg: string) => void;
};

export function PlatformIntegrationsPanel({ roles = [], refreshKey = 0, onAction }: Props) {
  const canMutate = hasPermission(roles, 'policy_mutate');
  const [autopilot, setAutopilot] = useState<AutopilotStatus | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [digestAt, setDigestAt] = useState<string | undefined>();
  const [digestPreview, setDigestPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [ap, ob, digest] = await Promise.all([
      fetchAutopilotStatus(),
      fetchOnboardingStatus(),
      fetchLatestDigest(),
    ]);
    setAutopilot(ap);
    setOnboarding(ob);
    setDigestAt(digest.generatedAt);
    setDigestPreview(digest.healthMarkdown?.slice(0, 400) || '');
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const onGenerateDigest = async () => {
    if (!canMutate) { onAction?.('Requires operator role'); return; }
    setBusy('digest');
    const res = await generateDigestNow();
    if (res.ok) {
      onAction?.('Digest generation started');
      await load();
    } else {
      onAction?.(res.error || 'Digest generation failed');
    }
    setBusy('');
  };

  if (loading && !autopilot && !onboarding) {
    return <p className="text-sm text-muted">Loading platform services…</p>;
  }

  return (
    <>
      <div className="kpi-grid" style={{ marginBottom: 'var(--space-5)' }}>
        <KpiCard
          label="Autopilot"
          value={autopilot?.autopilotEnabled ? 'Enabled' : 'Disabled'}
          accent={autopilot?.autopilotEnabled ? 'success' : 'neutral'}
          secondary={autopilot?.scheduler?.running ? 'Scheduler running' : 'Scheduler idle'}
        />
        <KpiCard
          label="Onboarding"
          value={onboarding?.onboarded ? 'Onboarded' : 'Not onboarded'}
          accent={onboarding?.onboarded ? 'success' : 'warning'}
          secondary={onboarding?.hasTraffic ? `${onboarding.totalCalls} calls` : 'No traffic yet'}
        />
        <KpiCard
          label="Last Digest"
          value={digestAt ? new Date(digestAt).toLocaleDateString() : '—'}
          accent="info"
          secondary={autopilot?.lastDigest?.generatedAt ? 'From autopilot' : 'Manual or scheduled'}
        />
        <KpiCard
          label="LLM"
          value={autopilot?.llm?.ok ? 'Healthy' : 'Offline'}
          accent={autopilot?.llm?.ok ? 'success' : 'danger'}
          secondary={autopilot?.llm?.reason || '—'}
        />
      </div>

      <div className="grid grid-12">
        <div className="col-span-6">
          <Card title="Autopilot status" subtitle="Background learning, threat research, and digests">
            {autopilot?.available === false ? (
              <EmptyState title="Unavailable" message={autopilot.error || 'Autopilot API unavailable'} />
            ) : autopilot ? (
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex gap-2 flex-wrap">
                  <Badge variant={autopilot.protection?.policyAutoApply ? 'success' : 'neutral'}>
                    Policy auto-apply {autopilot.protection?.policyAutoApply ? 'on' : 'off'}
                  </Badge>
                  <Badge variant={autopilot.learning?.threatResearchEnabled ? 'success' : 'neutral'}>
                    Threat research {autopilot.learning?.threatResearchEnabled ? 'on' : 'off'}
                  </Badge>
                </div>
                {autopilot.messages?.length ? (
                  <ul className="text-xs text-muted" style={{ margin: 0, paddingLeft: 16 }}>
                    {autopilot.messages.slice(0, 4).map((m) => <li key={m}>{m}</li>)}
                  </ul>
                ) : null}
              </div>
            ) : (
              <EmptyState title="No data" message="Autopilot status not returned" />
            )}
          </Card>
        </div>

        <div className="col-span-6">
          <Card title="Onboarding checklist" subtitle="First-run setup for this tenant">
            {onboarding ? (
              <ul className="text-sm" style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
                <li className="flex items-center gap-2 mb-2">
                  <Badge variant={onboarding.onboarded ? 'success' : 'warning'}>
                    {onboarding.onboarded ? 'Done' : 'Pending'}
                  </Badge>
                  <span>Client onboarded</span>
                </li>
                <li className="flex items-center gap-2 mb-2">
                  <Badge variant={onboarding.configCount > 0 ? 'success' : 'warning'}>
                    {onboarding.configCount > 0 ? 'Done' : 'Pending'}
                  </Badge>
                  <span>{onboarding.configCount} MCP config(s)</span>
                </li>
                <li className="flex items-center gap-2 mb-2">
                  <Badge variant={onboarding.hasTraffic ? 'success' : 'warning'}>
                    {onboarding.hasTraffic ? 'Done' : 'Pending'}
                  </Badge>
                  <span>Traffic recorded ({onboarding.totalCalls} calls)</span>
                </li>
                <li className="flex items-center gap-2 mb-2">
                  <Badge variant={onboarding.lastAnalysisAt ? 'success' : 'neutral'}>
                    {onboarding.lastAnalysisAt ? 'Done' : 'Optional'}
                  </Badge>
                  <span>Last analysis {onboarding.lastAnalysisState || '—'}</span>
                </li>
              </ul>
            ) : (
              <EmptyState title="No onboarding data" message="Onboarding API unavailable" />
            )}
          </Card>
        </div>
      </div>

      <Card title="Scheduled digests" subtitle="Health and security report bundles" style={{ marginTop: 'var(--space-4)' }}>
        <div className="flex gap-2 mb-3">
          <Button variant="primary" size="sm" loading={busy === 'digest'} disabled={!!busy} onClick={() => void onGenerateDigest()}>
            Generate digest now
          </Button>
        </div>
        {digestPreview ? (
          <pre className="text-xs text-muted" style={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
            {digestPreview}{digestPreview.length >= 400 ? '…' : ''}
          </pre>
        ) : (
          <EmptyState title="No digest yet" message="Generate a digest to preview health markdown" />
        )}
      </Card>
    </>
  );
}
