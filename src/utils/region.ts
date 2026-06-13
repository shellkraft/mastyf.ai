/**
 * Multi-region labeling — active-passive failover; not active-active replication.
 */
export function getMastyffAiRegion(): string {
  return (
    process.env['MASTYFF_AI_REGION'] ||
    process.env['AWS_REGION'] ||
    process.env['GCP_REGION'] ||
    'default'
  );
}

export function getMastyffAiRegionLabels(): Record<string, string> {
  return { region: getMastyffAiRegion() };
}
