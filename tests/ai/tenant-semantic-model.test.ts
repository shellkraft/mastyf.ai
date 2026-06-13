import { describe, expect, it } from 'vitest';
import {
  tenantSemanticModelName,
  buildLoraExportManifest,
  MIN_LORA_LABELED_ROWS,
} from '../../src/ai/tenant-semantic-model.js';

describe('tenant-semantic-model', () => {
  it('builds tenant-scoped Ollama model name', () => {
    expect(tenantSemanticModelName('acme-corp')).toBe('mastyff-ai-threat:acme-corp');
  });

  it('builds LoRA export manifest', () => {
    const manifest = buildLoraExportManifest('acme', 600);
    expect(manifest.rowCount).toBe(600);
    expect(manifest.modelName).toContain('acme');
    expect(manifest.ollamaCreateHint).toContain('pnpm ai:train-tenant-model');
    expect(manifest.ollamaCreateHint).toContain('MASTYFF_AI_TENANT_SEMANTIC_MODEL=true');
  });

  it('requires minimum labeled rows constant', () => {
    expect(MIN_LORA_LABELED_ROWS).toBeGreaterThanOrEqual(500);
  });
});
