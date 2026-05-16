import { describe, it, expect } from 'vitest';
import type { ProxyCallRecord } from '../../src/types.js';
import { chiSquareBins, detectDrift } from '../../src/ai/drift-detector.js';

function record(
  serverName: string,
  toolName: string,
  tokens: number,
  blocked: boolean,
  daysAgo: number,
): ProxyCallRecord {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return {
    serverName,
    toolName,
    requestTokens: tokens,
    responseTokens: 0,
    totalTokens: tokens,
    durationMs: 50,
    timestamp: d.toISOString(),
    blocked,
  };
}

describe('drift-detector', () => {
  it('chiSquareBins flags divergent histograms', () => {
    const a = [10, 10, 10, 10, 0, 0, 0, 0];
    const b = [0, 0, 0, 0, 10, 10, 10, 10];
    const { pValue } = chiSquareBins(a, b);
    expect(pValue).toBeLessThan(0.05);
  });

  it('detects synthetic token distribution shift per server:tool', () => {
    const records: ProxyCallRecord[] = [];
    for (let i = 0; i < 20; i++) {
      records.push(record('srv', 'Shell', 80 + (i % 10), false, 8 + (i % 4)));
    }
    for (let i = 0; i < 20; i++) {
      records.push(record('srv', 'Shell', 900 + (i % 50), i % 3 === 0, 1 + (i % 4)));
    }

    const report = detectDrift(records);
    expect(report.driftDetected).toBe(true);
    expect(report.tools.some((t) => t.serverTool === 'srv:Shell')).toBe(true);
  });

  it('stable traffic does not trigger drift', () => {
    const records: ProxyCallRecord[] = [];
    for (let day = 1; day <= 12; day++) {
      for (let i = 0; i < 10; i++) {
        records.push(record('srv', 'Read', 200, false, day));
      }
    }
    const report = detectDrift(records);
    expect(report.driftDetected).toBe(false);
  });
});
