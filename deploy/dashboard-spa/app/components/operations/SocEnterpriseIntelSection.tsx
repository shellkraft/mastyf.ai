'use client';

import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { KpiCard } from '../ui/KpiCard';
import { EmptyState } from '../ui/EmptyState';

type Props = {
  supplyChain: Record<string, unknown> | null;
  shadowRedTeam: Record<string, unknown> | null;
  signatureHints: Record<string, unknown> | null;
};

export function SocEnterpriseIntelSection({ supplyChain, shadowRedTeam, signatureHints }: Props) {
  const supplyNodes = ((supplyChain?.graph as { nodes?: unknown[] })?.nodes ?? []).length;
  const hints = (signatureHints?.hints as Array<Record<string, unknown>>) ?? [];
  const bypassCount = Number(shadowRedTeam?.bypassCount ?? 0);
  const newBypasses = Number(shadowRedTeam?.newBypasses ?? 0);

  return (
    <>
      <div className="kpi-grid" style={{ marginBottom: 'var(--space-5)' }}>
        <KpiCard label="Supply Chain Nodes" value={supplyNodes} accent={supplyNodes > 0 ? 'info' : 'neutral'} />
        <KpiCard label="Shadow Bypasses" value={bypassCount} accent={bypassCount > 0 ? 'danger' : 'success'} />
        <KpiCard label="New Bypasses" value={newBypasses} accent={newBypasses > 0 ? 'warning' : 'success'} />
        <KpiCard label="Fleet Hints" value={hints.length} accent={hints.length > 0 ? 'info' : 'neutral'} />
      </div>

      <div className="grid grid-12">
        <div className="col-span-4">
          <Card title="MCP Supply Chain" subtitle="Tool dependency graph from swarm ToolWatch">
            {!supplyChain?.hasData ? (
              <p className="text-sm text-muted">
                {typeof supplyChain?.hint === 'string' ? supplyChain.hint : 'Run security swarm with SWARM_TOOL_WATCH=true'}
              </p>
            ) : (
              <p className="text-sm">{supplyNodes} node(s) mapped across your MCP server toolchain.</p>
            )}
          </Card>
        </div>
        <div className="col-span-4">
          <Card title="Shadow Red Team" subtitle="Bypass detection from adversarial replay">
            {!shadowRedTeam?.hasData ? (
              <p className="text-sm text-muted">
                {typeof shadowRedTeam?.hint === 'string' ? shadowRedTeam.hint : 'Run shadow red-team swarm pass'}
              </p>
            ) : (
              <div className="text-sm">
                <p>{bypassCount} bypass(es) detected · {newBypasses} new</p>
                <div style={{ marginTop: 8 }}>
                  <Badge variant={shadowRedTeam.threatLabQueued ? 'warning' : 'neutral'}>
                    Threat Lab {shadowRedTeam.threatLabQueued ? 'queued' : 'idle'}
                  </Badge>
                </div>
              </div>
            )}
          </Card>
        </div>
        <div className="col-span-4">
          <Card title="Federated Signatures" subtitle="Cross-instance anonymized threat hints">
            {hints.length === 0 ? (
              <p className="text-sm text-muted">Requires multiple fleet instances reporting the same signature.</p>
            ) : (
              <ul className="text-sm" style={{ margin: 0, paddingLeft: 'var(--space-4)' }}>
                {hints.slice(0, 5).map(h => (
                  <li key={String(h.signatureId)} style={{ marginBottom: 'var(--space-1)' }}>{String(h.message)}</li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {hints.length > 5 ? (
        <div className="section">
          <Card title="All Fleet Hints">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Signature</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {hints.map(h => (
                    <tr key={String(h.signatureId)}>
                      <td><code className="text-xs">{String(h.signatureId)}</code></td>
                      <td className="text-sm">{String(h.message)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : hints.length === 0 && !supplyChain?.hasData && !shadowRedTeam?.hasData ? (
        <EmptyState title="No enterprise intel yet" message="Run Swarm Analysis with ToolWatch and shadow red-team enabled" />
      ) : null}
    </>
  );
}
