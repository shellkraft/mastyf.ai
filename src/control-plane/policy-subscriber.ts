/**
 * Polls MCP Mastyff AI Cloud for policy updates and hot-reloads local tenant policy.
 */
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import type { PolicyWatcher } from '../policy/policy-watcher.js';
import { Logger } from '../utils/logger.js';

let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastVersion = 0;

function controlPlaneUrl(): string | null {
  return process.env['MASTYFF_AI_CONTROL_PLANE_URL']?.replace(/\/$/, '') || null;
}

function cloudApiKey(): string | null {
  return process.env['MASTYFF_AI_CLOUD_API_KEY']?.trim()
    || process.env['CONTROL_PLANE_API_KEY']?.trim()
    || null;
}

function tenantPolicyPath(tenantSlug: string): string {
  const base = process.env['MASTYFF_AI_POLICY_TEMPLATES_DIR']
    || join(process.cwd(), 'policy-templates');
  return join(base, 'tenants', tenantSlug, 'policy.yaml');
}

export function isPolicySubscriberEnabled(): boolean {
  return Boolean(
    controlPlaneUrl()
    && cloudApiKey()
    && process.env['MASTYFF_AI_POLICY_SYNC_ENABLED'] !== 'false',
  );
}

export async function fetchAndApplyCloudPolicy(
  tenantSlug: string,
  policyWatcher?: PolicyWatcher | null,
): Promise<{ applied: boolean; version: number }> {
  const base = controlPlaneUrl();
  const apiKey = cloudApiKey();
  if (!base || !apiKey) return { applied: false, version: lastVersion };

  const res = await fetch(`${base}/api/v1/policy`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`Policy fetch failed (${res.status})`);
  }

  const versionHeader = res.headers.get('x-policy-version');
  const version = versionHeader ? parseInt(versionHeader, 10) : 0;
  if (version > 0 && version <= lastVersion) {
    return { applied: false, version: lastVersion };
  }

  const yaml = await res.text();
  if (!yaml.trim()) return { applied: false, version: lastVersion };

  const path = tenantPolicyPath(tenantSlug);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, yaml, 'utf-8');

  if (policyWatcher) {
    await policyWatcher.reloadNow?.();
  }

  lastVersion = version > 0 ? version : lastVersion + 1;
  Logger.info(`[policy-subscriber] Applied cloud policy v${lastVersion} → ${path}`);
  return { applied: true, version: lastVersion };
}

export function startPolicySubscriber(
  tenantSlug: string,
  policyWatcher?: PolicyWatcher | null,
): void {
  if (pollTimer || !isPolicySubscriberEnabled()) return;
  const intervalMs = parseInt(process.env['MASTYFF_AI_POLICY_SYNC_INTERVAL_MS'] || '60000', 10);

  const tick = () => {
    void fetchAndApplyCloudPolicy(tenantSlug, policyWatcher).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      Logger.debug(`[policy-subscriber] sync failed: ${msg}`);
    });
  };

  tick();
  pollTimer = setInterval(tick, intervalMs);
  Logger.info(`[policy-subscriber] Cloud policy sync started (tenant=${tenantSlug})`);
}

export function stopPolicySubscriber(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export function resetPolicySubscriberForTests(): void {
  stopPolicySubscriber();
  lastVersion = 0;
}
