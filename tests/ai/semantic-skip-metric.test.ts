import { describe, it, expect, beforeEach } from 'vitest';
import { reportSemanticAuditSkipped } from '../../src/ai/semantic-llm-rate-limit.js';
import * as Metrics from '../../src/utils/metrics.js';

describe('semantic skip metric', () => {
  beforeEach(() => {
    reportSemanticAuditSkipped('no_api_key', 'default');
  });

  it('exposes mcp_guardian_semantic_audit_skipped_total', async () => {
    const text = await Metrics.registry.getSingleMetricAsString(
      'mcp_guardian_semantic_audit_skipped_total',
    );
    expect(text).toContain('mcp_guardian_semantic_audit_skipped_total');
    expect(text).toMatch(/no_api_key/);
  });
});
