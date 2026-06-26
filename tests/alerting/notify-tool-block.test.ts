import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  alertPolicyBlock: vi.fn(),
  checkAndRespondToCriticalBlock: vi.fn(),
  trackBlockSpike: vi.fn(),
}));

vi.mock('../../src/alerting/webhook-alerter.js', () => ({
  alertPolicyBlock: mocks.alertPolicyBlock,
}));

vi.mock('../../src/alerting/incident-responder.js', () => ({
  checkAndRespondToCriticalBlock: mocks.checkAndRespondToCriticalBlock,
  trackBlockSpike: mocks.trackBlockSpike,
}));

describe('notify-tool-block', () => {
  beforeEach(() => {
    mocks.alertPolicyBlock.mockClear();
    mocks.checkAndRespondToCriticalBlock.mockClear();
    mocks.trackBlockSpike.mockClear();
  });

  it('fans out policy block alerts to webhook and incident hooks', async () => {
    const { notifyToolBlock } = await import('../../src/alerting/notify-tool-block.js');

    notifyToolBlock({
      serverName: 'srv',
      toolName: 'run_terminal',
      rule: 'deny-shell',
      reason: 'blocked',
      requestId: 'req-1',
      anomalyScore: 0.95,
    });

    await vi.waitFor(() => {
      expect(mocks.alertPolicyBlock).toHaveBeenCalledWith('srv', 'run_terminal', 'deny-shell', 'blocked', 'req-1');
      expect(mocks.trackBlockSpike).toHaveBeenCalledWith(true);
      expect(mocks.checkAndRespondToCriticalBlock).toHaveBeenCalledWith('blocked', 0.95, 'run_terminal', 'srv');
    });
  });
});
