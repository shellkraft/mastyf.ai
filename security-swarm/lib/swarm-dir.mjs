/**
 * Resolve security-swarm artifact directory (tenant-scoped or legacy global).
 * Set MASTYFF_AI_SWARM_DIR for per-tenant dashboard runs.
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(__dir, '..', '..');

export function resolveSwarmDir() {
  return process.env.MASTYFF_AI_SWARM_DIR || join(REPO_ROOT, 'reports', 'security-swarm');
}
