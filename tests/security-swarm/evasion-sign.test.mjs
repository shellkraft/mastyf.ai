import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  signEvasionManifest,
  verifyEvasionManifest,
} from '../../security-swarm/lib/evasion-sign.mjs';

describe('evasion manifest signing', () => {
  const prev = process.env.MASTYFF_AI_SWARM_EVASION_SIGNING_KEY;

  beforeEach(() => {
    process.env.MASTYFF_AI_SWARM_EVASION_SIGNING_KEY = 'test-signing-key';
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.MASTYFF_AI_SWARM_EVASION_SIGNING_KEY;
    else process.env.MASTYFF_AI_SWARM_EVASION_SIGNING_KEY = prev;
  });

  it('signs and verifies manifest', () => {
    const base = {
      timestamp: '2026-05-23T00:00:00.000Z',
      count: 1,
      promotions: [{ id: 'adv-999', path: 'x.json', branch: 'swarm/corpus-adv-999' }],
      instructions: 'test',
    };
    const signed = signEvasionManifest(base);
    expect(signed.signature).toBeTruthy();
    expect(verifyEvasionManifest(signed).ok).toBe(true);
  });

  it('rejects tampered manifest', () => {
    const signed = signEvasionManifest({
      timestamp: '2026-05-23T00:00:00.000Z',
      count: 0,
      promotions: [],
      instructions: 'test',
    });
    signed.promotions.push({ id: 'evil' });
    expect(verifyEvasionManifest(signed).ok).toBe(false);
  });
});
