import { describe, expect, it } from 'vitest';
import { routeSemanticModelForTenant, tenantSemanticModelName } from '../../src/ai/tenant-semantic-model.js';

describe('tenant-semantic-model routing', () => {
  it('resolves tenant model name slug', () => {
    expect(tenantSemanticModelName('acme corp')).toBe('mastyff-ai-threat:acme-corp');
  });

  it('routes explicit model first', () => {
    const prev = process.env.MASTYFF_AI_SEMANTIC_LOCAL_MODEL;
    process.env.MASTYFF_AI_SEMANTIC_LOCAL_MODEL = 'custom:model';
    expect(routeSemanticModelForTenant('acme').source).toBe('explicit');
    if (prev) process.env.MASTYFF_AI_SEMANTIC_LOCAL_MODEL = prev;
    else delete process.env.MASTYFF_AI_SEMANTIC_LOCAL_MODEL;
  });
});
