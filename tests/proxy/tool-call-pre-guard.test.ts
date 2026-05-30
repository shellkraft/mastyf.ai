import { describe, it, expect } from 'vitest';
import { toolCallGuardBlockResponse } from '../../src/proxy/tool-call-pre-guard.js';

describe('toolCallGuardBlockResponse', () => {
  it('includes id 0 on block responses', () => {
    const res = toolCallGuardBlockResponse(0, {
      blocked: true,
      code: -32001,
      message: 'Blocked by MCP Guardian: oversize',
    });
    expect(res.id).toBe(0);
    expect((res.error as { code: number }).code).toBe(-32001);
  });

  it('omits id for notifications', () => {
    const res = toolCallGuardBlockResponse(null, {
      blocked: true,
      code: -32001,
      message: 'blocked',
    });
    expect(res.id).toBeUndefined();
  });
});
