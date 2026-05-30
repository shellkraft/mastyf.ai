import { describe, it, expect } from 'vitest';
import { buildAgenticDashboardSummary } from '../../src/utils/agentic-dashboard-summary.js';
import { createContainer } from '../../src/container.js';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('agentic dashboard summary', () => {
  it('builds summary with container and empty db', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'agentic-dash-'));
    const dbPath = join(dir, 'history.db');
    const container = await createContainer(dbPath);
    const summary = await buildAgenticDashboardSummary(container.db, container, 'default', 7);
    expect(summary.available).toBe(true);
    expect(summary.kpis.trustGrade).toBeDefined();
    expect(Array.isArray(summary.trafficSeries)).toBe(true);
    expect(summary.compliance.frameworks.length).toBeGreaterThan(0);
    expect(summary.compliance.frameworks[0].postureScore).toBeGreaterThanOrEqual(0);
  });

  it('reports empty guidance when no container and no db', async () => {
    const summary = await buildAgenticDashboardSummary(null, null, 'default', 7);
    expect(summary.available).toBe(true);
    expect(summary.agenticEnabled).toBe(false);
    expect(summary.hasProxyHistory).toBe(false);
    expect(summary.emptyReason).toMatch(/not initialized|proxy traffic/i);
  });
});
