import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RuntimeModelPricing } from '../../src/services/runtime-model-pricing.js';

describe('RuntimeModelPricing', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.MASTYFF_AI_MODEL;
    delete process.env.ANTHROPIC_MODEL;
    delete process.env.OPENAI_MODEL;
    delete process.env.MCP_PRICING_MODEL;
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('resolveModelId does not recurse through detectActivePricing', async () => {
    process.env.MASTYFF_AI_MODEL = 'gpt-4o';
    const pricing = new RuntimeModelPricing();
    vi.spyOn(pricing as any, 'readClinePricing').mockReturnValue(null);
    vi.spyOn(pricing as any, 'readClineModelIdOnly').mockReturnValue(null);
    const detectSpy = vi.spyOn(pricing as any, 'detectActivePricing');
    vi.spyOn(pricing['pricingClient'], 'getModelPricing').mockResolvedValue({
      input: 2.5,
      output: 10,
      isLive: true,
    });

    const resolved = await pricing.resolveModelId('gpt-4o');
    expect(resolved?.modelId).toBe('gpt-4o');
    expect(detectSpy).not.toHaveBeenCalled();
  });

  it('getActivePricing resolves env model without stack overflow', async () => {
    process.env.MASTYFF_AI_MODEL = 'claude-3-5-sonnet';
    const pricing = new RuntimeModelPricing();
    vi.spyOn(pricing as any, 'readClinePricing').mockReturnValue(null);
    vi.spyOn(pricing as any, 'readClineModelIdOnly').mockReturnValue(null);
    vi.spyOn(pricing['pricingClient'], 'getModelPricing').mockResolvedValue({
      input: 3,
      output: 15,
      isLive: false,
    });

    const active = await pricing.getActivePricing();
    expect(active?.modelId).toBe('claude-3-5-sonnet');
    expect(active?.source).toBe('litellm');
  });
});
