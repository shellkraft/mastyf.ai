type Props = {
  tier: 'static' | 'live';
  source?: 'computed' | 'attested';
};

export function ScanTierBadge({ tier, source }: Props) {
  const label =
    source === 'attested'
      ? 'Verified by maintainer'
      : tier === 'live'
        ? 'Live scan'
        : 'Static analysis';

  const detail =
    source === 'attested'
      ? 'Score published with signed attestation from a maintainer proxy scan.'
      : tier === 'live'
        ? 'MCP server was started and probed for tools and auth signals.'
        : 'Score from npm registry metadata, CVE/OSV feeds, and supply-chain heuristics.';

  return (
    <span className="scan-tier-badge" title={detail}>
      {label}
    </span>
  );
}
