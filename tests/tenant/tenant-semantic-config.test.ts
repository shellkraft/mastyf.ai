import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isSyncSemanticResponseEnabledForTenant,
  isSyncSemanticResponseEnabledGlobal,
  isSemanticAsyncEnabledForTenant,
  isSemanticStrictForTenant,
  resetTenantSemanticConfigForTests,
} from '../../src/tenant/tenant-semantic-config.js';

describe('tenant semantic config', () => {
  const prev = process.env.MASTYFF_AI_TENANT_SEMANTIC_JSON;
  const prevSync = process.env.MASTYFF_AI_SEMANTIC_SYNC_RESPONSE;

  beforeEach(() => {
    resetTenantSemanticConfigForTests();
    delete process.env.MASTYFF_AI_SEMANTIC_SYNC_RESPONSE;
  });

  afterEach(() => {
    resetTenantSemanticConfigForTests();
    if (prev) process.env.MASTYFF_AI_TENANT_SEMANTIC_JSON = prev;
    if (prevSync) process.env.MASTYFF_AI_SEMANTIC_SYNC_RESPONSE = prevSync;
  });

  it('production global default enables sync response', () => {
    const prevNode = process.env.NODE_ENV;
    delete process.env.MASTYFF_AI_SEMANTIC_SYNC_RESPONSE;
    process.env.NODE_ENV = 'production';
    expect(isSyncSemanticResponseEnabledGlobal()).toBe(true);
    if (prevNode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNode;
  });

  it('tenant override enables sync response for one tenant only', () => {
    process.env.MASTYFF_AI_TENANT_SEMANTIC_JSON = JSON.stringify({
      acme: { syncResponse: true },
      beta: { syncResponse: false },
    });
    expect(isSyncSemanticResponseEnabledForTenant('acme')).toBe(true);
    expect(isSyncSemanticResponseEnabledForTenant('beta')).toBe(false);
    expect(isSyncSemanticResponseEnabledForTenant('other')).toBe(false);
  });

  it('falls back to global async flag', () => {
    process.env.MASTYFF_AI_SEMANTIC_ASYNC = 'true';
    expect(isSemanticAsyncEnabledForTenant('any')).toBe(true);
  });

  it('tenant strict override', () => {
    process.env.MASTYFF_AI_TENANT_SEMANTIC_JSON = JSON.stringify({
      strict: { strict: true },
      lax: { strict: false },
    });
    delete process.env.MASTYFF_AI_SEMANTIC_STRICT;
    expect(isSemanticStrictForTenant('strict')).toBe(true);
    expect(isSemanticStrictForTenant('lax')).toBe(false);
  });
});
