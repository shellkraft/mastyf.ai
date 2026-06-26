import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CircuitBreaker } from '../../src/utils/circuit-breaker.js';

const mocks = vi.hoisted(() => ({
  sendAlert: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/alerting/webhook-alerter.js', () => ({
  sendAlert: mocks.sendAlert,
}));

describe('circuit-breaker alerting', () => {
  beforeEach(() => {
    mocks.sendAlert.mockClear();
  });

  it('pushes webhook alert when circuit opens after failures', async () => {
    const breaker = new CircuitBreaker('test-upstream', { failureThreshold: 2, resetTimeoutMs: 60_000 });

    breaker.recordFailure();
    breaker.recordFailure();

    await vi.waitFor(() => {
      expect(mocks.sendAlert).toHaveBeenCalledWith(expect.objectContaining({
        severity: 'warning',
        title: 'Circuit open: test-upstream',
        serverName: 'test-upstream',
      }));
    });
  });

  it('pushes webhook alert on forceOpen', async () => {
    const breaker = new CircuitBreaker('forced');
    breaker.forceOpen('manual isolation');

    await vi.waitFor(() => {
      expect(mocks.sendAlert).toHaveBeenCalledWith(expect.objectContaining({
        message: 'manual isolation',
      }));
    });
  });
});
