import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  validateTenantId,
  resolveTenantContext,
  resolveTenantId,
  resolveCliTenantId,
  resolveTenantFromEnv,
  tenantRateLimitKey,
  InvalidTenantIdError,
  DEFAULT_TENANT_ID,
  isMultiTenantModeEnabled,
} from '../../src/tenant/resolve-tenant.js';
import { getCircuitBreaker, resetCircuitBreakerRegistryForTests } from '../../src/utils/circuit-breaker-registry.js';
import {
  recordInstantBlockEvent,
  loadAttackLearningState,
  resetInstantAttackLearningState,
} from '../../src/ai/instant-attack-learning.js';
import { resetBlockLearningDebounce } from '../../src/ai/block-learning.js';
import { HistoryDatabase } from '../../src/database/history-db.js';
import { resolveAttackLearningStatePath } from '../../src/ai/ai-paths.js';
import {
  validateJwtTenantBinding,
  extractTenantFromJwtPayload,
  resolveAuthenticatedTenant,
  resolveProxyTenantId,
  JwtTenantRequiredError,
} from '../../src/tenant/jwt-tenant-binding.js';
import { PolicyEngine } from '../../src/policy/policy-engine.js';
import { TenantPolicyRegistry } from '../../src/policy/tenant-policy-registry.js';
import { load } from 'js-yaml';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { PolicyConfig } from '../../src/policy/policy-types.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const defaultPolicy = load(
  readFileSync(resolve(__dir, '../../default-policy.yaml'), 'utf-8'),
) as PolicyConfig;

describe('multi-tenancy', () => {
  describe('resolve-tenant', () => {
    const prevTenant = process.env.MASTYFF_AI_TENANT_ID;

    afterEach(() => {
      if (prevTenant === undefined) delete process.env.MASTYFF_AI_TENANT_ID;
      else process.env.MASTYFF_AI_TENANT_ID = prevTenant;
    });

    it('accepts valid tenant ids', () => {
      expect(validateTenantId('acme-corp')).toBe('acme-corp');
      expect(validateTenantId('tenant123')).toBe('tenant123');
    });

    it('rejects invalid tenant ids', () => {
      expect(() => validateTenantId('')).toThrow(InvalidTenantIdError);
      expect(() => validateTenantId('../evil')).toThrow(InvalidTenantIdError);
      expect(() => validateTenantId('bad/slash')).toThrow(InvalidTenantIdError);
      expect(() => validateTenantId('-leading-hyphen')).toThrow(InvalidTenantIdError);
      expect(() => validateTenantId('a'.repeat(65))).toThrow(InvalidTenantIdError);
    });

    it('resolves header over env', () => {
      process.env.MASTYFF_AI_TENANT_ID = 'env-tenant';
      const ctx = resolveTenantContext({
        headers: { 'x-mastyff-ai-tenant': 'header-tenant' },
      });
      expect(ctx).toEqual({ tenantId: 'header-tenant', source: 'header' });
    });

    it('falls back to env/default', () => {
      delete process.env.MASTYFF_AI_TENANT_ID;
      expect(resolveTenantId()).toBe(DEFAULT_TENANT_ID);
      process.env.MASTYFF_AI_TENANT_ID = 'pod-tenant';
      expect(resolveTenantContext().tenantId).toBe('pod-tenant');
      expect(resolveTenantContext().source).toBe('env');
    });

    it('formats tenant rate limit keys consistently', () => {
      expect(tenantRateLimitKey('acme', 'dashboard-api:1.2.3.4')).toBe(
        'tenant:acme:dashboard-api:1.2.3.4',
      );
    });

    it('resolveTenantFromEnv uses MASTYFF_AI_TENANT_ID', () => {
      process.env.MASTYFF_AI_TENANT_ID = 'env-only';
      expect(resolveTenantFromEnv()).toBe('env-only');
    });

    it('resolveCliTenantId prefers --tenant over env', () => {
      process.env.MASTYFF_AI_TENANT_ID = 'env-tenant';
      expect(resolveCliTenantId({ tenant: 'flag-tenant' })).toBe('flag-tenant');
    });

    it('resolveCliTenantId requires tenant when multi-tenant mode without env', () => {
      const prevMulti = process.env.MASTYFF_AI_MULTI_TENANT_ENABLED;
      const prevTenant = process.env.MASTYFF_AI_TENANT_ID;
      delete process.env.MASTYFF_AI_TENANT_ID;
      process.env.MASTYFF_AI_MULTI_TENANT_ENABLED = 'true';
      expect(() => resolveCliTenantId()).toThrow(InvalidTenantIdError);
      if (prevMulti === undefined) delete process.env.MASTYFF_AI_MULTI_TENANT_ENABLED;
      else process.env.MASTYFF_AI_MULTI_TENANT_ENABLED = prevMulti;
      if (prevTenant === undefined) delete process.env.MASTYFF_AI_TENANT_ID;
      else process.env.MASTYFF_AI_TENANT_ID = prevTenant;
      expect(isMultiTenantModeEnabled()).toBe(process.env.MASTYFF_AI_MULTI_TENANT_ENABLED === 'true');
    });
  });

  describe('circuit breakers', () => {
    beforeEach(() => resetCircuitBreakerRegistryForTests());

    it('isolates failure state per tenant', () => {
      const server = 'filesystem';
      const breakerA = getCircuitBreaker('tenant-a', server);
      const breakerB = getCircuitBreaker('tenant-b', server);

      expect(breakerA).not.toBe(breakerB);

      for (let i = 0; i < 5; i++) breakerA.recordFailure();
      expect(breakerA.getState()).toBe('OPEN');
      expect(breakerB.getState()).toBe('CLOSED');
      expect(breakerB.allowRequest()).toBe(true);
    });
  });

  describe('attack learning isolation', () => {
    let root: string;
    const createdPaths: string[] = [];

    beforeEach(() => {
      root = mkdtempSync(join(tmpdir(), 'mastyff-ai-mt-'));
      process.env.MASTYFF_AI_AI_ENABLED = 'true';
      process.env.MASTYFF_AI_AI_INSTANT_LEARNING = 'true';
      process.env.MASTYFF_AI_AI_ATTACK_STATE_PATH = join(root, 'default-attack.json');
      resetInstantAttackLearningState();
      resetBlockLearningDebounce();
    });

    afterEach(() => {
      resetInstantAttackLearningState();
      resetBlockLearningDebounce();
      delete process.env.MASTYFF_AI_AI_ENABLED;
      delete process.env.MASTYFF_AI_AI_INSTANT_LEARNING;
      delete process.env.MASTYFF_AI_AI_ATTACK_STATE_PATH;
      for (const p of createdPaths) {
        try { rmSync(p, { recursive: true, force: true }); } catch { /* ignore */ }
      }
    });

    it('isolates in-memory attack learning state per tenant', () => {
      const tenantA = `tenant-a-${Date.now()}`;
      const tenantB = `tenant-b-${Date.now()}`;
      recordInstantBlockEvent({
        serverName: 's',
        toolName: 't',
        block_rule: 'secret-scan',
        block_reason: 'secret',
        argsFingerprint: 'a1',
        tenantId: tenantA,
      });
      recordInstantBlockEvent({
        serverName: 's',
        toolName: 't',
        block_rule: 'path-guard',
        block_reason: 'path',
        argsFingerprint: 'b1',
        tenantId: tenantB,
      });

      const stateA = loadAttackLearningState(tenantA);
      const stateB = loadAttackLearningState(tenantB);
      expect(stateA.totalEvents).toBe(1);
      expect(stateB.totalEvents).toBe(1);
      expect(stateA.ruleToolCounts['secret-scan:t']).toBeDefined();
      expect(stateA.ruleToolCounts['path-guard:t']).toBeUndefined();
      expect(stateB.ruleToolCounts['path-guard:t']).toBeDefined();
      expect(stateB.ruleToolCounts['secret-scan:t']).toBeUndefined();
    });
  });

  describe('history db tenant scoping', () => {
    it('eraseAllAuditData scopes call_records by tenant', async () => {
      const db = new HistoryDatabase(':memory:');
      await db.addCallRecord({
        serverName: 'srv',
        toolName: 'read',
        requestTokens: 1,
        responseTokens: 1,
        totalTokens: 2,
        durationMs: 1,
        timestamp: new Date().toISOString(),
        tenantId: 'tenant-a',
      });
      await db.addCallRecord({
        serverName: 'srv',
        toolName: 'write',
        requestTokens: 1,
        responseTokens: 1,
        totalTokens: 2,
        durationMs: 1,
        timestamp: new Date().toISOString(),
        tenantId: 'tenant-b',
      });

      const erased = db.eraseAllAuditData('tenant-a');
      expect(erased.callRecords).toBe(1);

      const remaining = await db.getCallRecordsForServer('srv', 10, 'tenant-b');
      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.tenantId).toBe('tenant-b');

      db.close();
    });

    it('getCallRecordsForServer filters by tenant when provided', async () => {
      const db = new HistoryDatabase(':memory:');
      await db.addCallRecord({
        serverName: 'srv',
        toolName: 'a',
        requestTokens: 1,
        responseTokens: 1,
        totalTokens: 2,
        durationMs: 1,
        timestamp: new Date().toISOString(),
        tenantId: 'x',
      });
      await db.addCallRecord({
        serverName: 'srv',
        toolName: 'b',
        requestTokens: 1,
        responseTokens: 1,
        totalTokens: 2,
        durationMs: 1,
        timestamp: new Date().toISOString(),
        tenantId: 'y',
      });

      expect(await db.getCallRecordsForServer('srv', 10, 'x')).toHaveLength(1);
      expect(await db.getCallRecordsForServer('srv', 10)).toHaveLength(2);
      db.close();
    });

    it('isolates cost_records by tenant', async () => {
      const db = new HistoryDatabase(':memory:');
      await db.addCostRecord('srv', 100, 0.01, 'tenant-a');
      await db.addCostRecord('srv', 200, 0.02, 'tenant-b');

      expect(await db.getTotalCost('srv', 'tenant-a')).toBe(0.01);
      expect(await db.getTotalCost('srv', 'tenant-b')).toBe(0.02);
      expect((await db.getCostHistory('srv', 'tenant-a')).length).toBe(1);
      db.close();
    });

    it('isolates security_scans by tenant', async () => {
      const db = new HistoryDatabase(':memory:');
      await db.addSecurityScan('srv', 90, 0, { note: 'a' }, 'tenant-a');
      await db.addSecurityScan('srv', 50, 1, { note: 'b' }, 'tenant-b');

      const scanA = await db.getLatestSecurityScan('srv', 'tenant-a');
      const scanB = await db.getLatestSecurityScan('srv', 'tenant-b');
      expect(scanA?.score).toBe(90);
      expect(scanB?.score).toBe(50);
      db.close();
    });

    it('isolates health_checks by tenant', async () => {
      const db = new HistoryDatabase(':memory:');
      await db.addHealthCheck('srv', 10, true, 3, 'tenant-a');
      await db.addHealthCheck('srv', 20, false, 3, 'tenant-b');

      expect(await db.getRecentSuccessRate('srv', 'tenant-a')).toBe(1);
      expect(await db.getRecentSuccessRate('srv', 'tenant-b')).toBe(0);
      db.close();
    });

    it('getDistinctScannedServers and getDistinctActiveServers filter by tenant', async () => {
      const db = new HistoryDatabase(':memory:');
      await db.addSecurityScan('srv-a', 90, 0, {}, 'tenant-a');
      await db.addSecurityScan('srv-b', 80, 0, {}, 'tenant-b');
      await db.addCallRecord({
        serverName: 'srv-c',
        toolName: 't',
        requestTokens: 1,
        responseTokens: 1,
        totalTokens: 2,
        durationMs: 1,
        timestamp: new Date().toISOString(),
        tenantId: 'tenant-a',
      });

      expect(await db.getDistinctScannedServers('tenant-a')).toEqual(['srv-a']);
      expect(await db.getDistinctScannedServers('tenant-b')).toEqual(['srv-b']);
      const activeA = await db.getDistinctActiveServers('tenant-a');
      expect(activeA).toContain('srv-a');
      expect(activeA).toContain('srv-c');
      expect(activeA).not.toContain('srv-b');
      db.close();
    });

    it('eraseAllAuditData scopes cost/security/health by tenant', async () => {
      const db = new HistoryDatabase(':memory:');
      await db.addCostRecord('srv', 30, 0.01, 'tenant-a');
      await db.addCostRecord('srv', 40, 0.02, 'tenant-b');
      await db.addSecurityScan('srv', 80, 0, {}, 'tenant-a');
      await db.addSecurityScan('srv', 60, 0, {}, 'tenant-b');
      await db.addHealthCheck('srv', 12, true, 3, 'tenant-a');
      await db.addHealthCheck('srv', 15, true, 3, 'tenant-b');

      const erased = db.eraseAllAuditData('tenant-a');
      expect(erased.costRecords).toBe(1);
      expect(erased.securityScans).toBe(1);
      expect(erased.healthChecks).toBe(1);

      expect(await db.getTotalCost('srv', 'tenant-b')).toBe(0.02);
      expect((await db.getLatestSecurityScan('srv', 'tenant-b'))?.score).toBe(60);
      expect(await db.getRecentSuccessRate('srv', 'tenant-b')).toBe(1);
      db.close();
    });
  });

  describe('jwt tenant binding', () => {
    const prevMulti = process.env.MASTYFF_AI_MULTI_TENANT_ENABLED;

    afterEach(() => {
      if (prevMulti === undefined) delete process.env.MASTYFF_AI_MULTI_TENANT_ENABLED;
      else process.env.MASTYFF_AI_MULTI_TENANT_ENABLED = prevMulti;
    });

    it('extracts tenant_id claim from JWT payload', () => {
      expect(extractTenantFromJwtPayload({ tenant_id: 'acme-corp', sub: 'u1' })).toBe('acme-corp');
    });

    it('rejects tenant mismatch when multi-tenant mode enabled', () => {
      process.env.MASTYFF_AI_MULTI_TENANT_ENABLED = 'true';
      const result = validateJwtTenantBinding('header-tenant', 'jwt-tenant');
      expect(result.ok).toBe(false);
    });

    it('allows match when multi-tenant mode enabled', () => {
      process.env.MASTYFF_AI_MULTI_TENANT_ENABLED = 'true';
      const result = validateJwtTenantBinding('acme', 'acme');
      expect(result.ok).toBe(true);
    });

    it('requires JWT tenant claim when authenticated in multi-tenant mode', () => {
      process.env.MASTYFF_AI_MULTI_TENANT_ENABLED = 'true';
      expect(() =>
        resolveAuthenticatedTenant({
          authenticated: true,
          headerTenant: 'acme-corp',
        }),
      ).toThrow(JwtTenantRequiredError);
    });

    it('uses JWT tenant as authoritative when authenticated', () => {
      process.env.MASTYFF_AI_MULTI_TENANT_ENABLED = 'true';
      const resolved = resolveProxyTenantId({
        authenticated: true,
        jwtTenantId: 'acme-corp',
        headers: { 'x-mastyff-ai-tenant': 'acme-corp' },
      });
      expect(resolved).toBe('acme-corp');
    });

    it('rejects header tenant mismatch with JWT in multi-tenant mode', () => {
      process.env.MASTYFF_AI_MULTI_TENANT_ENABLED = 'true';
      expect(() =>
        resolveProxyTenantId({
          authenticated: true,
          jwtTenantId: 'acme-corp',
          headers: { 'x-mastyff-ai-tenant': 'other-corp' },
        }),
      ).toThrow(JwtTenantRequiredError);
    });
  });

  describe('tenant policy registry', () => {
    it('loads per-tenant policy override from policy-templates/tenants', () => {
      const base = new PolicyEngine(defaultPolicy);
      const registry = new TenantPolicyRegistry(base, defaultPolicy);
      const engine = registry.getEngine('acme-corp');
      expect(engine).toBeTruthy();
      const decision = engine!.evaluate({
        serverName: 'srv',
        toolName: 'search',
        arguments: {},
        requestId: '1',
        requestTokens: 1,
        timestamp: new Date().toISOString(),
        tenantId: 'other-tenant',
        agentIdentity: {
          sub: 'agent',
          issuer: 'test',
          scopes: ['read'],
        },
      });
      expect(decision.action).toBe('block');
      expect(decision.rule).toBe('acme-tenant-scope');
    });
  });

  describe('ai-paths tenant dirs', () => {
    it('resolves per-tenant attack learning paths', () => {
      expect(resolveAttackLearningStatePath('acme')).toContain(
        join('tenants', 'acme', '.attack-learning-state.json'),
      );
      expect(resolveAttackLearningStatePath(DEFAULT_TENANT_ID)).toContain(
        '.attack-learning-state.json',
      );
      expect(resolveAttackLearningStatePath(DEFAULT_TENANT_ID)).not.toContain('tenants');
    });
  });
});
