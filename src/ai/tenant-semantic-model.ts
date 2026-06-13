/**
 * Tenant-scoped semantic model — Phase 3 LoRA readiness gate + Ollama model resolution.
 */
import { loadSemanticAuditRecordsAsync } from './semantic-audit-store.js';
import { isCalibratorSeededRecord } from './threat-lab.js';

export const MIN_LORA_LABELED_ROWS = parseInt(process.env.MASTYFF_AI_TENANT_LORA_MIN_ROWS || '500', 10);

export type TenantModelReadiness = {
  tenantId: string;
  ready: boolean;
  labeledCount: number;
  minRequired: number;
  modelName: string;
  exportPath: string;
  message: string;
};

export function tenantSemanticModelName(tenantId: string): string {
  const slug = tenantId.replace(/[^a-zA-Z0-9_-]/g, '-');
  return `mastyff-ai-threat:${slug}`;
}

export function resolveTenantSemanticModel(tenantId?: string): string | null {
  const explicit = process.env.MASTYFF_AI_SEMANTIC_LOCAL_MODEL?.trim();
  if (explicit) return explicit;
  if (!tenantId || tenantId === 'default') return null;
  if (process.env.MASTYFF_AI_TENANT_SEMANTIC_MODEL !== 'true') return null;
  return tenantSemanticModelName(tenantId);
}

export async function checkTenantModelReadiness(tenantId: string): Promise<TenantModelReadiness> {
  const records = await loadSemanticAuditRecordsAsync({
    tenantId,
    sinceMs: 365 * 24 * 60 * 60 * 1000,
    limit: 10000,
  });
  const labeled = records.filter(
    (r) => r.labeled && r.label && r.label !== 'ignored' && !isCalibratorSeededRecord(r),
  );
  const minRequired = Number.isFinite(MIN_LORA_LABELED_ROWS) ? MIN_LORA_LABELED_ROWS : 500;
  const ready = labeled.length >= minRequired;
  const modelName = tenantSemanticModelName(tenantId);
  const exportPath = `exports/training-dataset-${tenantId}.jsonl`;

  return {
    tenantId,
    ready,
    labeledCount: labeled.length,
    minRequired,
    modelName,
    exportPath,
    message: ready
      ? `Ready for LoRA fine-tune — register ${modelName} in Ollama after export`
      : `Need ${minRequired - labeled.length} more labeled rows (${labeled.length}/${minRequired})`,
  };
}

export type LoraExportManifest = {
  tenantId: string;
  modelName: string;
  rowCount: number;
  generatedAt: string;
  ollamaCreateHint: string;
};

export function buildLoraExportManifest(tenantId: string, rowCount: number): LoraExportManifest {
  const modelName = tenantSemanticModelName(tenantId);
  return {
    tenantId,
    modelName,
    rowCount,
    generatedAt: new Date().toISOString(),
    ollamaCreateHint: `pnpm ai:train-tenant-model -- --tenant=${tenantId} && MASTYFF_AI_SEMANTIC_LOCAL_MODEL=${modelName} MASTYFF_AI_TENANT_SEMANTIC_MODEL=true`,
  };
}

/** Resolve model for hot-path semantic routing — tenant model when registered and enabled. */
export function routeSemanticModelForTenant(tenantId?: string): {
  model: string | null;
  source: 'explicit' | 'tenant' | 'default';
} {
  const explicit = process.env.MASTYFF_AI_SEMANTIC_LOCAL_MODEL?.trim();
  if (explicit) return { model: explicit, source: 'explicit' };
  const tenantModel = resolveTenantSemanticModel(tenantId);
  if (tenantModel) return { model: tenantModel, source: 'tenant' };
  return { model: null, source: 'default' };
}
