import { describe, expect, it } from 'vitest';
import { parseHeartbeatBody } from '../lib/fleet-heartbeat';

describe('fleet-heartbeat', () => {
  it('requires instanceId', () => {
    const result = parseHeartbeatBody({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('instanceId');
  });

  it('parses valid heartbeat payload', () => {
    const result = parseHeartbeatBody({
      instanceId: 'mastyff-ai-prod-1',
      instanceName: 'prod-1',
      region: 'us-east-1',
      version: '3.2.0',
      hostname: 'pod-abc',
      metrics: { totalRequests: 100 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.instanceId).toBe('mastyff-ai-prod-1');
      expect(result.data.region).toBe('us-east-1');
      expect(result.data.metrics?.totalRequests).toBe(100);
    }
  });

  it('rejects non-object body', () => {
    expect(parseHeartbeatBody(null).ok).toBe(false);
    expect(parseHeartbeatBody('string').ok).toBe(false);
  });
});
