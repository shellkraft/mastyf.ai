import { describe, it, expect, afterEach } from 'vitest';
import { isGatewayModeEnabled } from '../../src/tenant/gateway-mode.js';

describe('gateway-mode', () => {
  const prev = process.env.MASTYFF_AI_GATEWAY_MODE;

  afterEach(() => {
    if (prev === undefined) delete process.env.MASTYFF_AI_GATEWAY_MODE;
    else process.env.MASTYFF_AI_GATEWAY_MODE = prev;
  });

  it('detects env flag', () => {
    process.env.MASTYFF_AI_GATEWAY_MODE = 'true';
    expect(isGatewayModeEnabled()).toBe(true);
  });
});
