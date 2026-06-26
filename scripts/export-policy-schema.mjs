#!/usr/bin/env node
/** Generate policy-schema.json from Zod PolicySchema. */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

const { exportPolicyJsonSchema } = await import('../dist/policy/policy-schema.js');
const schema = await exportPolicyJsonSchema();
const outPath = join(root, 'policy-schema.json');
writeFileSync(outPath, JSON.stringify(schema, null, 2));
console.log(`Wrote ${outPath}`);
