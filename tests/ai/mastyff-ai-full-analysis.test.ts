import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildMastyffAiFullAnalysis } from '../../src/ai/mastyff-ai-full-analysis.js';
import type { IDatabase } from '../../src/database/database-interface.js';
import type { ProxyCallRecord } from '../../src/types.js';

vi.mock('../../src/ai/mcp-health-report.js', () => ({
  buildMcpHealthReport: vi.fn(async () => ({
    generatedAt: new Date().toISOString(),
    windowDays: 7,
    verdict: 'healthy',
    headline: 'OK',
    executiveSummary: ['100 calls'],
    servers: [{ name: 'test-server', latencyMs: 10, successRatePct: 99, toolCount: 3, circuitBreaker: 'closed', totalCalls: 100, blockedCalls: 2, summary: 'Healthy' }],
    performance: { avgLatencyMs: 10, passRatePct: 98, totalRequests: 100, blockedRequests: 2, totalCostUsd: 0.01 },
    securityPosture: { policyMode: 'block', ruleSummary: '5 rules', topBlockRules: ['path-traversal'] },
    recommendations: [{ priority: 1, action: 'Keep monitoring' }],
    citations: [{ id: 'exec:requests', source: 'history.db', text: '100 requests' }],
    markdown: '# Health',
    source: 'measured',
  })),
}));

vi.mock('../../src/utils/dashboard-executive-summary.js', () => ({
  buildExecutiveSummary: vi.fn(async () => ({
    timestamp: new Date().toISOString(),
    windowDays: 7,
    totalRequests: 100,
    blockedRequests: 2,
    passedRequests: 98,
    passRatePct: 98,
    blockRatePct: 2,
    totalCostUsd: 0.01,
    burnRatePerHour: 0.001,
    projectedMonthlyUsd: 0.5,
    avgLatencyMs: 10,
    activeServers: 1,
    budgetUsd: null,
    budgetUtilizationPct: null,
    runwayDays: null,
    topServersByCost: [],
    topToolsByCalls: [{ tool: 'read_file', calls: 50 }],
    meta: { generatedAt: new Date().toISOString(), windowDays: 7, recordCount: 100, source: 'measured' },
  })),
}));

vi.mock('../../src/utils/autopilot-status.js', () => ({
  buildAutopilotStatus: vi.fn(async () => ({
    timestamp: new Date().toISOString(),
    autopilotEnabled: true,
    config: {},
    license: { pro: true, swarm: true, ai: true, dashboard: true },
    protection: { historyDbAttached: true, policyAutoApply: false },
    learning: {
      aiEnabled: true,
      pendingSuggestions: 0,
      threatResearchEnabled: true,
      threatResearchQueue: { queued: 0, running: false },
    },
    scheduler: { running: true, lastRunAt: null, nextRunAt: null },
    lastDigest: null,
    recentEvents: [],
    llm: { ok: false, reason: 'test' },
    messages: ['Protection is automatic'],
  })),
}));

vi.mock('../../src/utils/swarm-artifacts.js', () => ({
  readPlainEnglishReport: vi.fn(() => null),
  ensurePlainEnglishReport: vi.fn(() => null),
}));

function mockDb(records: ProxyCallRecord[]): IDatabase {
  return {
    getCallRecordsForServer: vi.fn(async () => records),
    getDistinctActiveServers: vi.fn(async () => ['test-server']),
    getDistinctScannedServers: vi.fn(async () => ['test-server']),
  } as unknown as IDatabase;
}

describe('buildMastyffAiFullAnalysis', () => {
  beforeEach(() => {
    vi.stubEnv('MASTYFF_AI_FULL_ANALYSIS_LLM', 'false');
  });

  it('returns measured analysis with sections and markdown', async () => {
    const records: ProxyCallRecord[] = [
      {
        serverName: 'test-server',
        toolName: 'read_file',
        requestTokens: 100,
        responseTokens: 50,
        totalTokens: 150,
        costUsd: 0.001,
        durationMs: 20,
        timestamp: new Date().toISOString(),
        blocked: false,
      },
      {
        serverName: 'test-server',
        toolName: 'write_file',
        requestTokens: 80,
        responseTokens: 0,
        totalTokens: 80,
        costUsd: 0,
        durationMs: 5,
        timestamp: new Date().toISOString(),
        blocked: true,
        blockRule: 'path-traversal',
      },
    ];
    const db = mockDb(records);
    const result = await buildMastyffAiFullAnalysis(db, 'default', {
      windowDays: 7,
      useLlm: false,
      historyDbAttached: true,
    });
    expect(result).not.toBeNull();
    expect(result!.source).toBe('measured');
    expect(result!.sections.protection.length).toBeGreaterThan(0);
    expect(result!.sections.traffic.length).toBeGreaterThan(0);
    expect(result!.markdown).toContain('# MCP Mastyff AI — Full Analysis');
    expect(result!.plainEnglishSummary.length).toBeGreaterThan(10);
    expect(result!.citations.length).toBeGreaterThan(0);
  });

  it('returns null when db is null', async () => {
    expect(await buildMastyffAiFullAnalysis(null, 'default')).toBeNull();
  });
});
