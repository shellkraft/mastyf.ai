/**
 * Per-tenant policy engines — merges base policy with tenant overrides.
 */
import { existsSync, readFileSync } from 'fs';
import { load } from 'js-yaml';
import { LRUCache } from 'lru-cache';
import { PolicyEngine } from './policy-engine.js';
import { getOrCreatePolicyEngine } from './policy-engine-cache.js';
import type { PolicyConfig } from './policy-types.js';
import { parsePolicyConfig } from './policy-schema.js';
import { resolveTenantPolicyPath, DEFAULT_TENANT_ID } from '../tenant/resolve-tenant.js';
import { Logger } from '../utils/logger.js';

const MAX_TENANT_ENGINES = 256;

export class TenantPolicyRegistry {
  private cache = new LRUCache<string, PolicyEngine>({ max: MAX_TENANT_ENGINES });
  private baseEngine: PolicyEngine | null;
  private baseConfig: PolicyConfig | null;

  constructor(baseEngine?: PolicyEngine | null, baseConfig?: PolicyConfig | null) {
    this.baseEngine = baseEngine ?? null;
    this.baseConfig = baseConfig ?? null;
  }

  setBase(engine: PolicyEngine, config?: PolicyConfig): void {
    this.baseEngine = engine;
    if (config) this.baseConfig = config;
    this.cache.clear();
  }

  getEngine(tenantId: string): PolicyEngine | null {
    const tid = tenantId || DEFAULT_TENANT_ID;
    if (tid === DEFAULT_TENANT_ID && this.baseEngine) {
      return this.baseEngine;
    }
    const cached = this.cache.get(tid);
    if (cached) return cached;

    const path = resolveTenantPolicyPath(tid);
    if (!existsSync(path)) {
      return this.baseEngine;
    }

    try {
      const tenantYaml = parsePolicyConfig(load(readFileSync(path, 'utf-8')));
      const merged = this.mergeConfigs(this.baseConfig, tenantYaml);
      const engine = getOrCreatePolicyEngine(merged);
      this.cache.set(tid, engine);
      Logger.info(`[tenant-policy] Loaded override for tenant '${tid}' from ${path}`);
      return engine;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      Logger.warn(`[tenant-policy] Failed to load ${path}: ${message}`);
      return this.baseEngine;
    }
  }

  private mergeConfigs(base: PolicyConfig | null, override: PolicyConfig): PolicyConfig {
    if (!base) return override;
    return {
      version: override.version || base.version,
      policy: {
        ...base.policy,
        ...override.policy,
        mode: override.policy.mode ?? base.policy.mode,
        rules: [...(base.policy.rules || []), ...(override.policy.rules || [])],
      },
    };
  }

  clearCache(): void {
    this.cache.clear();
  }
}
