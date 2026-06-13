import { readdirSync } from 'fs';
import { join, extname } from 'path';
import { pathToFileURL } from 'url';
import type { SecretFinding } from '../types.js';
import { Logger } from '../utils/logger.js';
import {
  PLUGIN_SDK_VERSION,
  type DetectorFinding,
  type DetectorPlugin,
  type DetectorScanContext,
} from './sdk.js';

export type {
  DetectorFinding,
  DetectorPlugin,
  DetectorScanContext,
} from './sdk.js';

export { createDetectorPlugin, PLUGIN_SDK_VERSION } from './sdk.js';

const registry: DetectorPlugin[] = [];
const loadedLifecycle = new Set<string>();

export function registerDetectorPlugin(plugin: DetectorPlugin): void {
  if (registry.some((p) => p.name === plugin.name)) {
    Logger.warn(`[plugins] detector '${plugin.name}' already registered — skipping duplicate`);
    return;
  }
  registry.push(plugin);
  if (plugin.onLoad && !loadedLifecycle.has(plugin.name)) {
    loadedLifecycle.add(plugin.name);
    Promise.resolve(plugin.onLoad()).catch((err: Error) => {
      Logger.warn(`[plugins] '${plugin.name}' onLoad failed: ${err.message}`);
    });
  }
  Logger.info(`[plugins] registered detector '${plugin.name}' (sdk ${PLUGIN_SDK_VERSION})`);
}

export function getRegisteredDetectorPlugins(): readonly DetectorPlugin[] {
  return registry;
}

export function clearDetectorPluginsForTests(): void {
  for (const plugin of registry) {
    if (plugin.onUnload) {
      Promise.resolve(plugin.onUnload()).catch(() => {});
    }
  }
  registry.length = 0;
  loadedLifecycle.clear();
}

function toSecretFinding(f: DetectorFinding, ctx: DetectorScanContext): SecretFinding {
  return {
    type: f.type,
    location: f.location || ctx.location || 'plugin',
    severity: f.severity,
    redacted: f.redacted,
    context: f.context ?? ctx.location,
    method: (f.method as SecretFinding['method']) || 'regex',
  };
}

/** Plugins on by default in v2.7; set MASTYFF_AI_PLUGINS_ENABLED=false to disable. */
export function areDetectorPluginsEnabled(): boolean {
  return process.env['MASTYFF_AI_PLUGINS_ENABLED'] !== 'false';
}

/** Run registered plugins when enabled. */
export function runDetectorPlugins(text: string, ctx: DetectorScanContext): SecretFinding[] {
  if (!areDetectorPluginsEnabled()) return [];
  const findings: SecretFinding[] = [];
  for (const plugin of registry) {
    try {
      const raw = plugin.scanArguments(text, ctx);
      const list = raw instanceof Promise ? [] : raw;
      if (raw instanceof Promise) {
        Logger.warn(`[plugins] '${plugin.name}' returned Promise — use sync scanArguments only`);
        continue;
      }
      for (const f of list) {
        findings.push(toSecretFinding(f, ctx));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      Logger.warn(`[plugins] detector '${plugin.name}' failed: ${message}`);
    }
  }
  return findings;
}

/** Load *.js plugins from MASTYFF_AI_PLUGIN_PATH (optional). */
export async function loadDetectorPluginsFromPath(): Promise<void> {
  const dir = process.env['MASTYFF_AI_PLUGIN_PATH'];
  if (!dir || !areDetectorPluginsEnabled()) return;

  let entries: string[];
  try {
    entries = readdirSync(dir).filter((f) => extname(f) === '.js' && !f.startsWith('_'));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    Logger.warn(`[plugins] cannot read MASTYFF_AI_PLUGIN_PATH=${dir}: ${message}`);
    return;
  }

  for (const file of entries) {
    try {
      const mod = await import(pathToFileURL(join(dir, file)).href);
      const plugin: DetectorPlugin | undefined = mod.default ?? mod.plugin;
      if (plugin?.name && typeof plugin.scanArguments === 'function') {
        registerDetectorPlugin(plugin);
      } else {
        Logger.warn(`[plugins] ${file} does not export a valid DetectorPlugin`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      Logger.warn(`[plugins] failed to load ${file}: ${message}`);
    }
  }
}
