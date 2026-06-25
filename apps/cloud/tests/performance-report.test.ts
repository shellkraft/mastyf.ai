import { describe, expect, it } from 'vitest';
import { aggregateFleetMetrics, parseReportWindowDays } from '../lib/performance-report';

describe('parseReportWindowDays', () => {
  it('defaults to 7 days', () => {
    expect(parseReportWindowDays(null)).toBe(7);
    expect(parseReportWindowDays('7d')).toBe(7);
  });

  it('parses Nd suffix', () => {
    expect(parseReportWindowDays('14d')).toBe(14);
    expect(parseReportWindowDays('90d')).toBe(90);
  });

  it('caps at 90 days', () => {
    expect(parseReportWindowDays('365d')).toBe(90);
  });
});

describe('aggregateFleetMetrics', () => {
  it('sums metrics from fleet snapshots', () => {
    const result = aggregateFleetMetrics([
      { metrics_snapshot: { totalRequests: 100, blockedRequests: 5, totalCostUsd: 1.25 } },
      { metrics_snapshot: { totalToolCalls: 50, blockedCalls: 2, totalCostUsd: 0.75 } },
    ]);
    expect(result.totalToolCalls).toBe(150);
    expect(result.blockedCalls).toBe(7);
    expect(result.totalCostUsd).toBe(2);
  });

  it('merges topBlockRules from snapshots', () => {
    const result = aggregateFleetMetrics([
      {
        metrics_snapshot: {
          topBlockRules: [{ rule: 'injection-block', count: 3 }],
        },
      },
      {
        metrics_snapshot: {
          topBlockRules: [{ rule: 'injection-block', count: 2 }, { rule: 'rate-limit', count: 1 }],
        },
      },
    ]);
    expect(result.topBlockRules).toEqual([
      { rule: 'injection-block', count: 5 },
      { rule: 'rate-limit', count: 1 },
    ]);
  });

  it('handles empty snapshots', () => {
    const result = aggregateFleetMetrics([]);
    expect(result.totalToolCalls).toBe(0);
    expect(result.blockedCalls).toBe(0);
    expect(result.totalCostUsd).toBe(0);
  });
});

describe('reports-auth', () => {
  it('rejects missing or invalid bearer without database', async () => {
    const { authorizeReportsRequest } = await import('../lib/reports-auth');
    expect((await authorizeReportsRequest(new Request('http://localhost'))).ok).toBe(false);
    expect((await authorizeReportsRequest(new Request('http://localhost', {
      headers: { authorization: 'Bearer not-a-gcp-key' },
    }))).ok).toBe(false);
  });

  it('accepts service key when configured', async () => {
    const prev = process.env.MASTYF_REPORTS_API_KEY;
    process.env.MASTYF_REPORTS_API_KEY = 'test-service-key';
    const { authorizeReportsRequest } = await import('../lib/reports-auth');
    const result = await authorizeReportsRequest(new Request('http://localhost', {
      headers: { authorization: 'Bearer test-service-key' },
    }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.source).toBe('service');
    process.env.MASTYF_REPORTS_API_KEY = prev;
  });
});
