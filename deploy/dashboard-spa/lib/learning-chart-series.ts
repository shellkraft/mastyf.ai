import type { VisualsData } from './mastyf-ai-api';
import { formatAxisTime, type AxisGranularity } from './chartTheme';

export type LearningChartRow = { label: string; blocks: number };

type HourlyRow = {
  hourStart: string;
  blocked: number;
  calls: number;
  label?: string;
};

/**
 * Maps instant-learning blocksPerMinute (live) or traffic hourly buckets (history fallback)
 * into chart rows with human-readable axis labels.
 */
export function buildLearningChartSeries(
  instantLearning: VisualsData['instantLearning'] | undefined,
  hourly: HourlyRow[],
  granularity: AxisGranularity,
): LearningChartRow[] {
  const source = instantLearning?.source;

  // history-db-fallback stores hourly block counts in blocksPerMinute — chart hourly buckets instead.
  if (source === 'history-db-fallback') {
    return hourly
      .filter((h) => h.blocked > 0)
      .map((h) => ({
        label: h.label ?? formatAxisTime(h.hourStart, granularity),
        blocks: h.blocked,
      }));
  }

  const perMin = instantLearning?.blocksPerMinute ?? [];
  if (perMin.length > 0) {
    return perMin.map((p) => ({
      label: `${Math.round(p.t / 60_000)}m`,
      blocks: Number(p.value) || 0,
    }));
  }

  return hourly
    .filter((h) => h.blocked > 0 || h.calls > 0)
    .map((h) => ({
      label: h.label ?? formatAxisTime(h.hourStart, granularity),
      blocks: h.blocked,
    }));
}

export function learningChartHasValues(rows: LearningChartRow[]): boolean {
  return rows.some((r) => r.blocks > 0);
}

export function learningChartTitle(
  instantLearning: VisualsData['instantLearning'] | undefined,
): string {
  const source = instantLearning?.source;
  if (source === 'live' && (instantLearning?.blocksPerMinute?.length ?? 0) > 0) {
    return `Blocks per minute (${source})`;
  }
  if (source === 'history-db-fallback') {
    return 'Blocks over time (history.db)';
  }
  return 'Blocks over time';
}
