import { describe, it, expect, afterEach } from 'vitest';
import { getMastyffAiRegion, getMastyffAiRegionLabels } from '../../src/utils/region.js';

describe('region', () => {
  const prev = process.env.MASTYFF_AI_REGION;

  afterEach(() => {
    if (prev === undefined) delete process.env.MASTYFF_AI_REGION;
    else process.env.MASTYFF_AI_REGION = prev;
  });

  it('defaults to default when unset', () => {
    delete process.env.MASTYFF_AI_REGION;
    expect(getMastyffAiRegion()).toBe('default');
  });

  it('reads MASTYFF_AI_REGION', () => {
    process.env.MASTYFF_AI_REGION = 'eu-west-1';
    expect(getMastyffAiRegionLabels()).toEqual({ region: 'eu-west-1' });
  });
});
