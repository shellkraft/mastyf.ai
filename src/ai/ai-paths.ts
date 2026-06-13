import { join } from 'path';
import { DEFAULT_TENANT_ID, resolveTenantId } from '../tenant/resolve-tenant.js';
import { mastyffAiHomeDir } from '../audit/tenant-audit-paths.js';

function tenantDataDir(tenantId?: string): string {
  const tid = tenantId || resolveTenantId();
  const base = mastyffAiHomeDir();
  if (tid === DEFAULT_TENANT_ID) {
    return base;
  }
  return join(base, 'tenants', tid);
}

function resolveTenantScopedPath(
  envKey: string,
  filename: string,
  tenantId?: string,
): string {
  const tid = tenantId || resolveTenantId();
  const envPath = process.env[envKey];
  if (envPath && tid === DEFAULT_TENANT_ID) {
    return envPath;
  }
  return join(tenantDataDir(tid), filename);
}

export function resolveAiLearningStatePath(tenantId?: string): string {
  return resolveTenantScopedPath('MASTYFF_AI_AI_STATE_PATH', '.ai-learning.json', tenantId);
}

export function resolveAiPendingSuggestionsPath(tenantId?: string): string {
  return resolveTenantScopedPath('MASTYFF_AI_AI_SUGGESTIONS_PATH', '.ai-pending-suggestions.json', tenantId);
}

export function resolveAiReportPath(tenantId?: string): string {
  return resolveTenantScopedPath('MASTYFF_AI_AI_REPORT_PATH', '.ai-report.json', tenantId);
}

export function resolveAiBaselinesPath(tenantId?: string): string {
  return resolveTenantScopedPath('MASTYFF_AI_AI_BASELINES_PATH', '.ai-baselines.json', tenantId);
}

export function resolveAttackLearningStatePath(tenantId?: string): string {
  return resolveTenantScopedPath(
    'MASTYFF_AI_AI_ATTACK_STATE_PATH',
    '.attack-learning-state.json',
    tenantId,
  );
}

export function resolveThreatStatePath(tenantId?: string): string {
  return resolveTenantScopedPath(
    'MASTYFF_AI_THREAT_STATE_PATH',
    '.threat-state.json',
    tenantId,
  );
}
