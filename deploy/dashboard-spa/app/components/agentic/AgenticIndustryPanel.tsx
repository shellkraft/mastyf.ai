'use client';

import { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { BadgeCopyButton } from './BadgeCopyButton';
import {
  fetchIndustryChainGraph,
  fetchIndustryCapabilityGraph,
  fetchIndustrySandboxTiers,
  fetchCertificationRegistry,
  fetchPublicBadgeMetadata,
  fetchSetupStatus,
  approvePlaybookAction,
  resolveCloudPublicUrl,
  type PublicBadgeMetadata,
} from '@/lib/mastyf-ai-api';

type Props = { refreshKey?: number };

function withGithubBadgeStyle(url: string): string {
  if (url.includes('style=')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}style=github`;
}

export function AgenticIndustryPanel({ refreshKey = 0 }: Props) {
  const [chain, setChain] = useState<Awaited<ReturnType<typeof fetchIndustryChainGraph>>>(null);
  const [capGraph, setCapGraph] = useState<Awaited<ReturnType<typeof fetchIndustryCapabilityGraph>>>(null);
  const [tiers, setTiers] = useState<Awaited<ReturnType<typeof fetchIndustrySandboxTiers>>>(null);
  const [certs, setCerts] = useState<Awaited<ReturnType<typeof fetchCertificationRegistry>>>(null);
  const [cloudBase, setCloudBase] = useState(resolveCloudPublicUrl());
  const [badgeMeta, setBadgeMeta] = useState<Record<string, PublicBadgeMetadata | null>>({});
  const [approvalId, setApprovalId] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [c, g, t, r, setup] = await Promise.all([
        fetchIndustryChainGraph(),
        fetchIndustryCapabilityGraph(),
        fetchIndustrySandboxTiers(),
        fetchCertificationRegistry(),
        fetchSetupStatus(),
      ]);
      setChain(c);
      setCapGraph(g);
      setTiers(t);
      setCerts(r);
      const base = resolveCloudPublicUrl(setup?.cloud?.controlPlaneUrl);
      setCloudBase(base);

      const rows = r?.certifications ?? [];
      const metaEntries = await Promise.all(
        rows
          .filter((row) => row.packageName)
          .map(async (row) => {
            const meta = await fetchPublicBadgeMetadata(row.packageName, base);
            return [row.serverName, meta] as const;
          }),
      );
      setBadgeMeta(Object.fromEntries(metaEntries));
    })();
  }, [refreshKey]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Industry Standard (v4)</h3>

      <Card className="p-4">
        <h4 className="font-medium mb-2">Certification registry &amp; public badges</h4>
        {(certs?.certifications ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">
            No certifications yet — run <code>mastyf-ai certify publish</code> or the certify_server MCP tool.
          </p>
        ) : (
          <ul className="text-sm space-y-3">
            {(certs?.certifications ?? []).slice(0, 12).map((c) => {
              const meta = badgeMeta[c.serverName];
              const badgeUrl = withGithubBadgeStyle(
                meta?.badgeUrl
                  ?? `${cloudBase}/api/v1/badge/${encodeURIComponent(c.packageName)}`,
              );
              const embed =
                meta?.embedMarkdown
                ?? `[![mastyf.ai security score](${badgeUrl})](${cloudBase}/certified/${encodeURIComponent(c.packageName)})`;
              return (
                <li key={c.serverName} className="flex flex-col gap-2 border-b border-gray-100 pb-2 last:border-0">
                  <div className="flex gap-2 items-center flex-wrap">
                    <Badge tone={c.level === 'gold' || c.level === 'platinum' ? 'success' : 'neutral'}>
                      {c.level}
                    </Badge>
                    <span className="font-medium">{c.serverName}</span>
                    <span className="text-gray-400">{c.score}/100</span>
                    <span className="text-gray-400 text-xs">{c.packageName}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={badgeUrl} alt={`mastyf.ai security score for ${c.packageName}`} width={220} height={36} />
                    <BadgeCopyButton markdown={embed} verifyUrl={meta?.verifyUrl} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h4 className="font-medium mb-2">Session chain ({chain?.count ?? 0})</h4>
          <div className="text-xs max-h-40 overflow-auto space-y-1">
            {(chain?.events ?? []).slice(0, 20).map((e, i) => (
              <div key={`${e.sessionId}-${i}`}>
                {e.agentId ?? e.sessionId.slice(0, 8)} → {e.toolName} [{e.eventType}]
                {e.blocked ? ' ⛔' : ''}
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <h4 className="font-medium mb-2">Capability graph ({capGraph?.count ?? 0})</h4>
          <div className="text-xs max-h-40 overflow-auto space-y-1">
            {(capGraph?.edges ?? []).slice(0, 20).map((e, i) => (
              <div key={`${e.sourceTool}-${i}`}>
                {e.serverName}: {e.sourceTool} → {e.targetResource ?? e.edgeType}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <h4 className="font-medium mb-2">Sandbox tier matrix</h4>
        <table className="data-table w-full text-sm">
          <thead>
            <tr>
              <th>Server</th>
              <th>Cert</th>
              <th>Tier</th>
            </tr>
          </thead>
          <tbody>
            {(tiers?.tiers ?? []).map((t) => (
              <tr key={t.serverName}>
                <td>{t.serverName}</td>
                <td>{t.certLevel}</td>
                <td>
                  <Badge tone={t.tier === 'allow' ? 'success' : t.tier === 'shadow' ? 'warn' : 'neutral'}>
                    {t.tier}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-4">
        <h4 className="font-medium mb-2">Playbook approval</h4>
        <div className="flex gap-2 flex-wrap">
          <input
            className="border rounded px-2 py-1 text-sm flex-1 min-w-[200px]"
            placeholder="Approval ID"
            value={approvalId}
            onChange={(e) => setApprovalId(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary text-sm"
            onClick={() => void approvePlaybookAction(approvalId, true).then((r) => setMsg(r.ok ? 'Approved' : r.error ?? 'Failed'))}
          >
            Approve
          </button>
          <button
            type="button"
            className="btn text-sm"
            onClick={() => void approvePlaybookAction(approvalId, false).then((r) => setMsg(r.ok ? 'Denied' : r.error ?? 'Failed'))}
          >
            Deny
          </button>
        </div>
        {msg ? <p className="text-xs mt-2 text-gray-500">{msg}</p> : null}
      </Card>
    </div>
  );
}
