/**
 * Default environment for `mastyff-ai start` (local dashboard + proxy).
 */
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function applyStartEnv(overrides?: Record<string, string>): void {
  const home = homedir();
  const defaults: Record<string, string> = {
    MASTYFF_AI_DB_PATH: join(home, '.mastyff-ai', 'history.db'),
    DASHBOARD_ENABLED: 'true',
    DASHBOARD_AUTH_DISABLED: 'true',
    MASTYFF_AI_CI_BYPASS_LICENSE: 'true',
    MASTYFF_AI_WS_ENABLED: 'true',
    MASTYFF_AI_LLM_ENABLED: 'true',
    METRICS_ENABLED: 'true',
    DASHBOARD_PORT: '4000',
    METRICS_PORT: '9090',
    OLLAMA_BASE_URL: 'http://127.0.0.1:11434',
    MASTYFF_AI_BLOCKING_MODE: 'block',
  };

  for (const [key, val] of Object.entries(defaults)) {
    if (process.env[key] === undefined) process.env[key] = val;
  }
  if (overrides) {
    for (const [key, val] of Object.entries(overrides)) {
      process.env[key] = val;
    }
  }
}

export function resolveStartPolicy(installRoot: string): string {
  const audit = join(installRoot, 'policy-audit.yaml');
  const def = join(installRoot, 'default-policy.yaml');
  if (existsSync(audit)) return audit;
  if (existsSync(def)) return def;
  return 'policy-audit.yaml';
}

export function isDashboardSpaBuilt(installRoot: string): boolean {
  return existsSync(join(installRoot, 'deploy', 'dashboard-spa', 'out', 'index.html'));
}
