import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getTribunalTimeoutAction,
  getTribunalTimeoutMs,
  sweepTribunalTimeouts,
} from '../../src/utils/tribunal-sla.js';

describe('tribunal SLA (M-016)', () => {
  beforeEach(() => {
    process.env.MASTYF_AI_TRIBUNAL_TIMEOUT_MS = '1000';
    process.env.MASTYF_AI_TRIBUNAL_TIMEOUT_ACTION = 'block';
  });

  afterEach(() => {
    delete process.env.MASTYF_AI_TRIBUNAL_TIMEOUT_MS;
    delete process.env.MASTYF_AI_TRIBUNAL_TIMEOUT_ACTION;
    vi.restoreAllMocks();
  });

  it('reads policy YAML tribunal config when env unset', async () => {
    delete process.env.MASTYF_AI_TRIBUNAL_TIMEOUT_MS;
    delete process.env.MASTYF_AI_TRIBUNAL_TIMEOUT_ACTION;
    const { setTribunalPolicyFromConfig, resetTribunalPolicyForTests } = await import('../../src/policy/tribunal-policy.js');
    setTribunalPolicyFromConfig({ timeout_ms: 60_000, timeout_action: 'allow' });
    expect(getTribunalTimeoutMs()).toBe(60_000);
    expect(getTribunalTimeoutAction()).toBe('allow');
    resetTribunalPolicyForTests();
  });

  it('reads timeout config from env (overrides policy)', () => {
    expect(getTribunalTimeoutMs()).toBe(1000);
    expect(getTribunalTimeoutAction()).toBe('block');
  });

  it('labels overdue records when action is block', async () => {
    vi.resetModules();
    vi.doMock('../../src/ai/semantic-audit-store.js', () => ({
      loadSemanticAuditRecordsAsync: async () => [
        {
          id: 'old-1',
          tenantId: 'default',
          requestId: 1,
          serverName: 's',
          toolName: 't',
          syncDecision: { action: 'pass', rule: 'r', reason: '' },
          semanticAudit: { suspicious: true, confidence: 0.9, categories: [], reasoning: '' },
          timestamp: new Date(Date.now() - 5000).toISOString(),
        },
      ],
      labelSemanticAuditRecord: vi.fn().mockResolvedValue(true),
    }));
    const mod = await import('../../src/utils/tribunal-sla.js');
    const result = await mod.sweepTribunalTimeouts();
    expect(result.processed).toBe(1);
  });
});
