import type { SecurityMonitorQuarantineRecord } from './mastyf-ai-api';

export type QuarantineEnforcementStatus = SecurityMonitorQuarantineRecord['enforcementStatus'];

export function formatEnforcementStatus(status?: QuarantineEnforcementStatus | string | null): string {
  switch (status) {
    case 'applied':
      return 'New policy rule applied';
    case 'already_blocked':
      return 'Already blocked by policy (archived only)';
    case 'already_present':
      return 'Matching quarantine rule already exists';
    case 'no_context':
      return 'Archived — no source context for a new rule';
    case 'skipped':
      return 'Skipped — no enforcement action';
    default:
      return status ? String(status) : 'Unknown';
  }
}

export function formatQuarantineResultMessage(
  threatId: string,
  opts?: { enforcementStatus?: QuarantineEnforcementStatus; appliedRuleName?: string },
): string {
  const label = formatEnforcementStatus(opts?.enforcementStatus);
  const rule = opts?.appliedRuleName ? ` Rule: ${opts.appliedRuleName}.` : '';
  return `Quarantined ${threatId}. ${label}.${rule} See Security → Quarantine → View policy for YAML.`;
}
