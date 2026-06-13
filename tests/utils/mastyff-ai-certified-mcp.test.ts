import { describe, expect, it } from 'vitest';
import { buildPartnerSignalFeed, evaluateMastyffAiCertification } from '../../src/utils/mastyff-ai-certified-mcp.js';

describe('mastyff-ai certification', () => {
  it('returns deterministic structure even without reports', () => {
    const status = evaluateMastyffAiCertification('/tmp/non-existent-root');
    expect(typeof status.certified).toBe('boolean');
    expect(['none', 'bronze', 'silver', 'gold']).toContain(status.level);
    expect(Array.isArray(status.checks)).toBe(true);
  });

  it('emits partner signal feed with certification keys', () => {
    const feed = buildPartnerSignalFeed('/tmp/non-existent-root');
    const keys = feed.signals.map((s) => s.key);
    expect(keys).toContain('mastyff-ai_certified');
    expect(keys).toContain('mastyff-ai_certification_level');
    expect(keys).toContain('mastyff-ai_checks_passed');
  });
});
