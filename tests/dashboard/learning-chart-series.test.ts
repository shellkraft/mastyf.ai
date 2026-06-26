import { describe, expect, it } from 'vitest';
import {
  buildLearningChartSeries,
  learningChartHasValues,
  learningChartTitle,
} from '../../deploy/dashboard-spa/lib/learning-chart-series';

describe('learning-chart-series', () => {
  const hourly = [
    { hourStart: '2026-06-26T10:00:00.000Z', blocked: 3, calls: 10 },
    { hourStart: '2026-06-26T11:00:00.000Z', blocked: 0, calls: 5 },
  ];

  it('uses hourly buckets for history-db-fallback instead of synthetic minute offsets', () => {
    const rows = buildLearningChartSeries(
      {
        source: 'history-db-fallback',
        blocksPerMinute: [{ t: 0, value: 3 }],
        totalEvents: 3,
        queuedSuggestions: 0,
        ruleToolPairs: [],
        classConfidence: [],
      },
      hourly,
      'hour',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.blocks).toBe(3);
    expect(rows[0]?.label).toMatch(/06-26/);
    expect(learningChartHasValues(rows)).toBe(true);
    expect(learningChartTitle({ source: 'history-db-fallback' })).toBe('Blocks over time (history.db)');
  });

  it('maps live blocksPerMinute into minute labels', () => {
    const rows = buildLearningChartSeries(
      {
        source: 'live',
        blocksPerMinute: [
          { t: 0, value: 2 },
          { t: 60_000, value: 1 },
        ],
        totalEvents: 3,
        queuedSuggestions: 0,
        ruleToolPairs: [],
        classConfidence: [],
      },
      hourly,
      'hour',
    );
    expect(rows).toEqual([
      { label: '0m', blocks: 2 },
      { label: '1m', blocks: 1 },
    ]);
    expect(learningChartTitle({ source: 'live', blocksPerMinute: [{ t: 0, value: 1 }] })).toBe(
      'Blocks per minute (live)',
    );
  });
});
