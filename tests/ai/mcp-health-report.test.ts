import { describe, expect, it } from 'vitest';
import { buildMcpHealthReport } from '../../src/ai/mcp-health-report.js';
import type { IDatabase } from '../../src/database/database-interface.js';
import type { ProxyCallRecord } from '../../src/types.js';

function mockDb(records: ProxyCallRecord[]): IDatabase {
  return {
    initialize: async () => {},
    close: async () => {},
    getDistinctScannedServers: async () => ['filesystem'],
    getCallRecordsForServer: async () => records,
    getRecentSuccessRate: async () => 0.95,
    getLatestHealthCheck: async () => ({ latency_ms: 42, tool_count: 3 }),
  } as unknown as IDatabase;
}

describe('mcp-health-report', () => {
  it('builds measured report from call records', async () => {
    const records: ProxyCallRecord[] = [
      {
        serverName: 'filesystem',
        toolName: 'read_file',
        requestTokens: 10,
        responseTokens: 10,
        totalTokens: 20,
        durationMs: 50,
        timestamp: new Date().toISOString(),
        blocked: false,
      },
      {
        serverName: 'filesystem',
        toolName: 'run_terminal',
        requestTokens: 10,
        responseTokens: 10,
        totalTokens: 20,
        durationMs: 60,
        timestamp: new Date().toISOString(),
        blocked: true,
        blockRule: 'SHELL-BLOCK',
      },
    ];
    const db = mockDb(records);
    const report = await buildMcpHealthReport(db, 'default', { windowDays: 7, useLlm: false });
    expect(report).not.toBeNull();
    expect(report!.source).toBe('measured');
    expect(report!.servers.length).toBeGreaterThan(0);
    expect(report!.markdown).toContain('Mastyff AI');
    expect(report!.executiveSummary.length).toBeGreaterThan(0);
    expect(report!.securityPosture.topBlockRules.some((r) => r.includes('SHELL-BLOCK'))).toBe(true);
  });

  it('returns null without database', async () => {
    const report = await buildMcpHealthReport(null, 'default');
    expect(report).toBeNull();
  });
});
