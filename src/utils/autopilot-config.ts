/**
 * Persisted Mastyff AI Autopilot configuration (~/.mastyff-ai/autopilot.json).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { DEFAULT_TENANT_ID, validateTenantId } from '../tenant/resolve-tenant.js';

export type AutopilotReportSchedule = 'off' | 'daily' | 'weekly';

export type AutopilotConfig = {
  version: 1;
  enabled: boolean;
  tenantId: string;
  initializedAt: string;
  reportSchedule: AutopilotReportSchedule;
  reportCronHour: number;
  policyPath: string;
  blockingMode: 'block' | 'audit' | 'warn';
  threatLabOnSemanticTp: boolean;
  corpusEvalGate: boolean;
};

function configDir(): string {
  return process.env.MASTYFF_AI_AUTOPILOT_CONFIG_DIR || join(homedir(), '.mastyff-ai');
}

export function autopilotConfigPath(): string {
  return process.env.MASTYFF_AI_AUTOPILOT_CONFIG_PATH || join(configDir(), 'autopilot.json');
}

export function lastDigestPath(): string {
  return process.env.MASTYFF_AI_LAST_DIGEST_PATH || join(configDir(), 'last-digest.json');
}

/** @deprecated use autopilotConfigPath() */
export const AUTOPILOT_CONFIG_PATH = join(homedir(), '.mastyff-ai', 'autopilot.json');

export function defaultAutopilotConfig(
  tenantId: string = DEFAULT_TENANT_ID,
): AutopilotConfig {
  return {
    version: 1,
    enabled: true,
    tenantId: validateTenantId(tenantId),
    initializedAt: new Date().toISOString(),
    reportSchedule: 'daily',
    reportCronHour: 6,
    policyPath: 'default-policy.yaml',
    blockingMode: 'block',
    threatLabOnSemanticTp: true,
    corpusEvalGate: true,
  };
}

export function readAutopilotConfig(): AutopilotConfig | null {
  const path = autopilotConfigPath();
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as Partial<AutopilotConfig>;
    const base = defaultAutopilotConfig(String(raw.tenantId || DEFAULT_TENANT_ID));
    return {
      ...base,
      ...raw,
      version: 1,
      tenantId: validateTenantId(String(raw.tenantId || base.tenantId)),
    };
  } catch {
    return null;
  }
}

export function writeAutopilotConfig(config: AutopilotConfig): void {
  const path = autopilotConfigPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export type LastDigestMeta = {
  generatedAt: string;
  tenantId: string;
  healthPath?: string;
  securityPath?: string;
};

export function writeLastDigestMeta(meta: LastDigestMeta): void {
  const path = lastDigestPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(meta, null, 2) + '\n', 'utf-8');
}

export function readLastDigestMeta(): LastDigestMeta | null {
  const path = lastDigestPath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as LastDigestMeta;
  } catch {
    return null;
  }
}
