/**
 * Side-effect import: exits unless MCP Mastyff AI Pro license is valid (or CI bypass).
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const feature = process.env.MASTYFF_AI_SWARM_LICENSE_FEATURE || 'swarm';

if (process.env.MASTYFF_AI_CI_BYPASS_LICENSE !== 'true') {
  const r = spawnSync(process.execPath, [join(__dir, 'require-pro-license.mjs'), feature], {
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}
