#!/usr/bin/env node
import { accessSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const required = [
  'index.js',
  'transports/http.js',
  'transports/http-fetch-client.js',
  'transports/stdio.js',
];

for (const rel of required) {
  const path = join(dist, rel);
  try {
    accessSync(path);
  } catch {
    console.error(`[verify-core-dist] missing ${rel} — run tsc in packages/core`);
    process.exit(1);
  }
}

console.log('[verify-core-dist] OK');
