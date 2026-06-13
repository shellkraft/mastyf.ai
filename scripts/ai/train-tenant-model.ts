#!/usr/bin/env npx tsx
/**
 * Tenant semantic model pipeline — export labeled JSONL, build few-shot Modelfile, register in Ollama.
 */
import { execSync, spawnSync } from 'child_process';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  checkTenantModelReadiness,
  tenantSemanticModelName,
} from '../../src/ai/tenant-semantic-model.js';
import { exportTenantTrainingDataset } from '../../src/ai/tenant-model-export.js';

const args = process.argv.slice(2);
const tenantArg = args.find((a) => a.startsWith('--tenant='));
const tenantId = tenantArg?.slice('--tenant='.length) || process.env.MASTYFF_AI_TENANT_ID || 'default';
const exportOnly = args.includes('--export-only');

function tryMlxTrain(datasetPath: string, adapterPath: string): boolean {
  const r = spawnSync(
    'python3',
    ['-m', 'mlx_lm.lora', '--train', '--data', datasetPath, '--adapter-path', adapterPath],
    { stdio: 'inherit' },
  );
  return r.status === 0;
}

async function main(): Promise<void> {
  const exported = await exportTenantTrainingDataset(tenantId);
  console.log(`[train-tenant-model] ${exported.readiness.message}`);
  console.log(`[train-tenant-model] Exported ${exported.rowsExported} rows → ${exported.exportPath}`);
  console.log(
    `[train-tenant-model] Modelfile (${exported.fewShotExamples} few-shot examples) → ${exported.modelfilePath}`,
  );

  if (exportOnly) {
    console.log(exported.manifest.ollamaCreateHint);
    return;
  }

  if (!exported.readiness.ready) {
    console.error(
      `[train-tenant-model] Not ready (${exported.readiness.labeledCount}/${exported.readiness.minRequired} labels).`,
    );
    process.exit(1);
  }

  const modelName = tenantSemanticModelName(tenantId);
  const adapterPath = join(process.cwd(), 'exports', `adapter-${tenantId}`);

  if (process.env.MASTYFF_AI_LORA_USE_MLX === 'true') {
    const mlxOk = tryMlxTrain(exported.exportPath, adapterPath);
    if (mlxOk) console.log(`[train-tenant-model] MLX adapter → ${adapterPath}`);
  }

  execSync(`ollama create ${modelName} -f ${exported.modelfilePath}`, { stdio: 'inherit' });
  console.log(`[train-tenant-model] Registered ${modelName}`);
  console.log(`Set: MASTYFF_AI_TENANT_SEMANTIC_MODEL=true MASTYFF_AI_SEMANTIC_LOCAL_MODEL=${modelName}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
