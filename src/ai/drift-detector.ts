import type { ProxyCallRecord } from '../types.js';
import { Logger } from '../utils/logger.js';
import { StructuredLogger } from '../utils/structured-logger.js';

export interface ToolDriftMetrics {
  serverTool: string;
  recentMeanTokens: number;
  priorMeanTokens: number;
  recentBlockRate: number;
  priorBlockRate: number;
  tokenChiSquare: number;
  tokenPValue: number;
  blockRateDelta: number;
  drifted: boolean;
}

export interface DriftReport {
  checkedAt: string;
  driftDetected: boolean;
  tools: ToolDriftMetrics[];
  fpRateDelta?: number;
}

export interface DriftState {
  lastReport?: DriftReport;
  frozen: boolean;
  frozenAt?: string;
}

const MS_7D = 7 * 24 * 60 * 60 * 1000;
const FP_DELTA_THRESHOLD = 0.02;
const P_VALUE_THRESHOLD = 0.05;

/** Chi-square critical values (df 1–20, alpha=0.05) — lightweight lookup. */
const CHI2_CRIT_005: Record<number, number> = {
  1: 3.841, 2: 5.991, 3: 7.815, 4: 9.488, 5: 11.07, 6: 12.592, 7: 14.067,
  8: 15.507, 9: 16.919, 10: 18.307, 11: 19.675, 12: 21.026, 13: 22.362,
  14: 23.685, 15: 24.996, 16: 26.296, 17: 27.587, 18: 28.869, 19: 30.144, 20: 31.41,
};

function chiSquarePValue(statistic: number, df: number): number {
  const crit = CHI2_CRIT_005[Math.min(20, Math.max(1, df))] ?? 31.41;
  return statistic >= crit ? 0.04 : 0.5;
}

function binHistogram(values: number[], bins = 8): number[] {
  if (values.length === 0) return new Array(bins).fill(0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const counts = new Array(bins).fill(0);
  if (max === min) {
    counts[0] = values.length;
    return counts;
  }
  for (const v of values) {
    const idx = Math.min(bins - 1, Math.floor(((v - min) / (max - min)) * bins));
    counts[idx]++;
  }
  return counts;
}

/** Binned chi-square comparing two token distributions. */
export function chiSquareBins(observed: number[], expected: number[]): { statistic: number; pValue: number } {
  const df = Math.max(1, observed.length - 1);
  let statistic = 0;
  const totalObs = observed.reduce((a, b) => a + b, 0) || 1;
  const totalExp = expected.reduce((a, b) => a + b, 0) || 1;
  for (let i = 0; i < observed.length; i++) {
    const exp = (expected[i] / totalExp) * totalObs || 0.5;
    const obs = observed[i];
    statistic += ((obs - exp) ** 2) / exp;
  }
  return { statistic, pValue: chiSquarePValue(statistic, df) };
}

function splitWindows(
  records: ProxyCallRecord[],
  now = Date.now(),
): { recent: ProxyCallRecord[]; prior: ProxyCallRecord[] } {
  const recentCut = now - MS_7D;
  const priorCut = now - 2 * MS_7D;
  const recent: ProxyCallRecord[] = [];
  const prior: ProxyCallRecord[] = [];
  for (const r of records) {
    const t = new Date(r.timestamp).getTime();
    if (Number.isNaN(t)) continue;
    if (t >= recentCut) recent.push(r);
    else if (t >= priorCut && t < recentCut) prior.push(r);
  }
  return { recent, prior };
}

function blockRate(recs: ProxyCallRecord[]): number {
  if (recs.length === 0) return 0;
  return recs.filter((r) => r.blocked).length / recs.length;
}

function meanTokens(recs: ProxyCallRecord[]): number {
  if (recs.length === 0) return 0;
  return recs.reduce((s, r) => s + (r.totalTokens || r.requestTokens + r.responseTokens || 0), 0) / recs.length;
}

export function detectDrift(
  records: ProxyCallRecord[],
  opts?: { labeledFpRateRecent?: number; labeledFpRatePrior?: number },
): DriftReport {
  const { recent, prior } = splitWindows(records);
  const byTool = new Map<string, { recent: ProxyCallRecord[]; prior: ProxyCallRecord[] }>();

  for (const r of recent) {
    const key = `${r.serverName}:${r.toolName}`;
    const bucket = byTool.get(key) || { recent: [], prior: [] };
    bucket.recent.push(r);
    byTool.set(key, bucket);
  }
  for (const r of prior) {
    const key = `${r.serverName}:${r.toolName}`;
    const bucket = byTool.get(key) || { recent: [], prior: [] };
    bucket.prior.push(r);
    byTool.set(key, bucket);
  }

  const tools: ToolDriftMetrics[] = [];
  let driftDetected = false;

  for (const [serverTool, buckets] of byTool) {
    if (buckets.recent.length < 5 || buckets.prior.length < 5) continue;

    const recentTokens = buckets.recent.map((r) => r.totalTokens || r.requestTokens + r.responseTokens || 0);
    const priorTokens = buckets.prior.map((r) => r.totalTokens || r.requestTokens + r.responseTokens || 0);
    const recentHist = binHistogram(recentTokens);
    const priorHist = binHistogram(priorTokens);
    const { statistic, pValue } = chiSquareBins(recentHist, priorHist);

    const recentBr = blockRate(buckets.recent);
    const priorBr = blockRate(buckets.prior);
    const blockRateDelta = Math.abs(recentBr - priorBr);

    const drifted = pValue < P_VALUE_THRESHOLD || blockRateDelta > FP_DELTA_THRESHOLD;
    if (drifted) driftDetected = true;

    tools.push({
      serverTool,
      recentMeanTokens: meanTokens(buckets.recent),
      priorMeanTokens: meanTokens(buckets.prior),
      recentBlockRate: recentBr,
      priorBlockRate: priorBr,
      tokenChiSquare: statistic,
      tokenPValue: pValue,
      blockRateDelta,
      drifted,
    });
  }

  let fpRateDelta: number | undefined;
  if (
    opts?.labeledFpRateRecent !== undefined &&
    opts?.labeledFpRatePrior !== undefined
  ) {
    fpRateDelta = Math.abs(opts.labeledFpRateRecent - opts.labeledFpRatePrior);
    if (fpRateDelta > FP_DELTA_THRESHOLD) driftDetected = true;
  }

  const report: DriftReport = {
    checkedAt: new Date().toISOString(),
    driftDetected,
    tools: tools.filter((t) => t.drifted),
    fpRateDelta,
  };

  if (driftDetected) {
    StructuredLogger.info({
      event: 'drift_detected',
      tools: report.tools.map((t) => t.serverTool),
      fpRateDelta: report.fpRateDelta,
    });
    Logger.warn(
      `[drift-detector] Drift detected on ${report.tools.length} tool(s); auto threshold adjustments frozen`,
    );
  }

  return report;
}

export function isDriftOverrideEnabled(): boolean {
  return process.env.MASTYFF_AI_AI_DRIFT_OVERRIDE === 'true';
}

export function shouldFreezeThresholdAdjustments(drift: DriftState | undefined): boolean {
  if (!drift?.frozen) return false;
  return !isDriftOverrideEnabled();
}
