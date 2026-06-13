import { describe, it, expect, vi, afterEach } from 'vitest';
import { CostAuditor } from '../../src/services/cost-auditor.js';
import { HistoryDatabase } from '../../src/database/history-db.js';
import { PricingClient } from '../../src/clients/pricing-client.js';
import { McpClient } from '../../src/utils/mcp-client.js';
import { estimateServerCostFromTools, allowsCostEstimates } from '../../src/utils/cost-estimate.js';
import { getDailyBudgetCapUsd } from '../../src/services/cost-auditor.js';

describe('CostAuditor audit-mode (no fabricated usage)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.MASTYFF_AI_COST_ALLOW_ESTIMATES;
  });

  it('disallows cost estimates by default', () => {
    delete process.env.MASTYFF_AI_COST_ALLOW_ESTIMATES;
    expect(allowsCostEstimates()).toBe(false);
  });

  it('reports model-only with zero tokens when no proxy records (default)', async () => {
    vi.spyOn(McpClient, 'probe').mockResolvedValue({
      success: true,
      toolCount: 2,
      toolNames: ['search', 'read_file'],
      tools: [
        {
          name: 'search',
          description: 'Search the codebase for symbols and text',
          inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
        },
        {
          name: 'read_file',
          description: 'Read a file from disk',
          inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
        },
      ],
      authRequired: false,
      latencyMs: 12,
    });

    const db = new HistoryDatabase(':memory:');
    const auditor = new CostAuditor(new PricingClient(), db);
    const report = await auditor.auditServer({
      name: 'fixture',
      transport: 'stdio',
      command: 'echo',
      args: ['ok'],
      env: { MASTYFF_AI_MODEL: 'gpt-4o-mini' },
    });

    expect(report.costSource).toBe('model-only');
    expect(report.tokensUsed).toBe(0);
    expect(report.estimatedCostUSD).toBe(0);
    expect(report.toolBreakdown).toHaveLength(0);
    expect(report.modelId).toBe('gpt-4o-mini');
    expect(report.provider).toBe('openai');
    expect(report.note).toContain('no proxy traffic');
    expect(report.note).toContain('mastyff-ai proxy');
    auditor.dispose();
    db.close();
  });

  it('uses legacy simulation only when MASTYFF_AI_COST_ALLOW_ESTIMATES=true', async () => {
    process.env.MASTYFF_AI_COST_ALLOW_ESTIMATES = 'true';
    expect(allowsCostEstimates()).toBe(true);

    vi.spyOn(McpClient, 'probe').mockResolvedValue({
      success: true,
      toolCount: 1,
      tools: [{ name: 'ping', description: 'Ping', inputSchema: { type: 'object', properties: {} } }],
      authRequired: false,
      latencyMs: 1,
    });

    const db = new HistoryDatabase(':memory:');
    const auditor = new CostAuditor(new PricingClient(), db);
    const report = await auditor.auditServer({
      name: 'fixture',
      transport: 'stdio',
      command: 'echo',
      env: { MASTYFF_AI_MODEL: 'gpt-4o-mini' },
    });

    expect(report.costSource).toBe('estimated');
    expect(report.tokensUsed).toBeGreaterThan(0);
    expect(report.toolBreakdown.length).toBeGreaterThan(0);
    auditor.dispose();
    db.close();
  });

  it('prefers proxy call_records over model-only audit', async () => {
    vi.spyOn(McpClient, 'probe').mockResolvedValue({
      success: true,
      tools: [{ name: 'should-not-use', description: 'x' }],
      authRequired: false,
      latencyMs: 1,
    });

    const db = new HistoryDatabase(':memory:');
    await db.addCallRecord({
      serverName: 'fixture',
      toolName: 'echo',
      requestTokens: 50,
      responseTokens: 50,
      totalTokens: 100,
      durationMs: 1,
      timestamp: new Date().toISOString(),
      model: 'gpt-4o',
      costUsd: 0.01,
      pricingSource: 'litellm',
    });
    db.flush();

    const auditor = new CostAuditor(new PricingClient(), db);
    const report = await auditor.auditServer({ name: 'fixture', transport: 'stdio', command: 'echo' });
    expect(report.costSource).toBe('actual');
    expect(report.tokensUsed).toBe(100);
    expect(report.toolBreakdown[0].toolName).toBe('echo');
    expect(McpClient.probe).not.toHaveBeenCalled();
    auditor.dispose();
    db.close();
  });

  it('estimateServerCostFromTools still available for opt-in path', async () => {
    const est = await estimateServerCostFromTools(
      [{ name: 'ping', description: 'Ping', inputSchema: { type: 'object', properties: {} } }],
      'gpt-4o-mini',
    );
    expect(est.totalTokens).toBeGreaterThan(0);
    expect(est.toolBreakdown).toHaveLength(1);
    expect(est.toolBreakdown[0].toolName).toBe('ping');
  });
});

describe('MASTYFF_AI_DAILY_BUDGET_USD with audit estimates', () => {
  const prev = process.env.MASTYFF_AI_DAILY_BUDGET_USD;

  afterEach(() => {
    if (prev === undefined) delete process.env.MASTYFF_AI_DAILY_BUDGET_USD;
    else process.env.MASTYFF_AI_DAILY_BUDGET_USD = prev;
  });

  it('still reads daily cap from env', () => {
    process.env.MASTYFF_AI_DAILY_BUDGET_USD = '10';
    expect(getDailyBudgetCapUsd()).toBe(10);
  });
});
