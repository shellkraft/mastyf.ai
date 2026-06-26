import { describe, expect, it } from 'vitest';
import { isValidOrgId, recentPackagesReportLimit } from '../lib/report-query-guards';

describe('report-query-guards', () => {
  it('accepts UUID org ids', () => {
    expect(isValidOrgId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('rejects injection-like org ids', () => {
    expect(isValidOrgId("'; DROP TABLE organizations; --")).toBe(false);
    expect(isValidOrgId('@/foo')).toBe(false);
  });

  it('caps recent package limit', () => {
    const prev = process.env.MASTYF_AI_REPORT_RECENT_PACKAGES_LIMIT;
    process.env.MASTYF_AI_REPORT_RECENT_PACKAGES_LIMIT = '500';
    expect(recentPackagesReportLimit()).toBe(100);
    process.env.MASTYF_AI_REPORT_RECENT_PACKAGES_LIMIT = '25';
    expect(recentPackagesReportLimit()).toBe(25);
    process.env.MASTYF_AI_REPORT_RECENT_PACKAGES_LIMIT = prev;
  });
});
