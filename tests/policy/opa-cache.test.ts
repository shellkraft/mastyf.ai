import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { evaluateOpaPolicy, resetOpaCacheForTests } from '../../src/policy/opa-policy.js';
import type { CallContext } from '../../src/policy/policy-types.js';

const ctx: CallContext = {
  serverName: 's',
  toolName: 't',
  arguments: { q: 1 },
  requestId: '1',
  requestTokens: 10,
  timestamp: new Date().toISOString(),
  tenantId: 'acme',
};

describe('OPA response cache', () => {
  const prevUrl = process.env['OPA_URL'];
  const prevTtl = process.env['MASTYFF_AI_OPA_CACHE_TTL_MS'];

  beforeEach(() => {
    resetOpaCacheForTests();
    process.env['OPA_URL'] = 'http://opa.test/v1/data/mcp';
    process.env['MASTYFF_AI_OPA_CACHE_TTL_MS'] = '60000';
  });

  afterEach(() => {
    resetOpaCacheForTests();
    vi.restoreAllMocks();
    if (prevUrl === undefined) delete process.env['OPA_URL'];
    else process.env['OPA_URL'] = prevUrl;
    if (prevTtl === undefined) delete process.env['MASTYFF_AI_OPA_CACHE_TTL_MS'];
    else process.env['MASTYFF_AI_OPA_CACHE_TTL_MS'] = prevTtl;
  });

  it('caches OPA block decisions by tenant/server/tool/args hash', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { allow: false, reason: 'denied' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const d1 = await evaluateOpaPolicy(ctx);
    const d2 = await evaluateOpaPolicy(ctx);

    expect(d1?.action).toBe('block');
    expect(d2?.action).toBe('block');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
