/**
 * Resolve a single-stdio-server Guardian MCP config JSON for proxy/start.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readOnboardArtifact } from '../cli/onboard.js';

function countStdioServers(cfg: Record<string, unknown>): number {
  const servers = Object.values(cfg.mcpServers || cfg.servers || {}) as Array<{
    command?: string;
    transport?: string;
  } | null>;
  return servers.filter((s) => s && (s.command || s.transport === 'stdio')).length;
}

function tryConfigPath(absPath: string): string | null {
  if (!existsSync(absPath)) return null;
  try {
    const cfg = JSON.parse(readFileSync(absPath, 'utf-8')) as Record<string, unknown>;
    if (countStdioServers(cfg) === 1) return absPath;
  } catch {
    /* invalid json */
  }
  return null;
}

function listJsonConfigs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => join(dir, f));
}

export interface PickGuardianConfigOptions {
  /** Explicit --config path */
  configPath?: string;
  /** Search roots (default: cwd) */
  searchRoots?: string[];
}

/**
 * Pick first valid single-stdio-server guardian config.
 * Priority: explicit path → onboard configsDir → guardian-configs under search roots.
 */
export function pickGuardianConfig(opts: PickGuardianConfigOptions = {}): string | null {
  if (opts.configPath) {
    const abs = resolve(opts.configPath);
    return tryConfigPath(abs);
  }

  const onboard = readOnboardArtifact();
  if (onboard?.configsDir) {
    for (const p of listJsonConfigs(onboard.configsDir)) {
      const hit = tryConfigPath(p);
      if (hit) return hit;
    }
  }

  const roots = opts.searchRoots?.length ? opts.searchRoots : [process.cwd()];
  const seen = new Set<string>();
  for (const root of roots) {
    const candidates = [
      join(root, 'guardian-configs', 'filesystem.json'),
      ...listJsonConfigs(join(root, 'guardian-configs')),
    ];
    for (const p of candidates) {
      if (seen.has(p)) continue;
      seen.add(p);
      const hit = tryConfigPath(p);
      if (hit) return hit;
    }
  }

  return null;
}
