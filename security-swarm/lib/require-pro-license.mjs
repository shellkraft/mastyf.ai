#!/usr/bin/env node
/**
 * Gate Security Swarm CLI — requires MCP Mastyff AI Pro (v3.0+).
 * Set MASTYFF_AI_CI_BYPASS_LICENSE=true only in CI workflows.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dir, '..', '..');
const feature = process.argv[2] || 'swarm';

if (process.env.MASTYFF_AI_CI_BYPASS_LICENSE === 'true') {
  process.exit(0);
}

const checkPro = join(REPO, 'dist', 'license', 'check-pro.js');
if (!existsSync(checkPro)) {
  console.error(
    '[license] Missing dist/license/check-pro.js — run `pnpm build` from the repo root before Security Swarm.',
  );
  process.exit(1);
}

const { runCheckProCli } = await import(checkPro);
const code = await runCheckProCli([feature]);
process.exit(code);
