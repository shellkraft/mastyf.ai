import { describe, it, expect } from 'vitest';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { McpProxyServer } from '../../src/proxy/proxy-server.js';
import { HistoryDatabase } from '../../src/database/history-db.js';
import { CostAuditor } from '../../src/services/cost-auditor.js';
import { PricingClient } from '../../src/clients/pricing-client.js';
import { McpServerConfig } from '../../src/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INTEGRATION_MCP_SERVER = resolve(__dirname, '..', '..', 'benchmarks', 'fixtures', 'integration-mcp-server.cjs');

describe('Proxy-to-Audit Integration', () => {
  const config: McpServerConfig = {
    name: 'test-integration',
    transport: 'stdio',
    command: 'node',
    args: [INTEGRATION_MCP_SERVER],
  };

  it('should capture real tokens via proxy and produce accurate cost report', async () => {
    process.env.MASTYFF_AI_MODEL = 'gpt-4o';
    const db = new HistoryDatabase(':memory:');
    const pricing = new PricingClient();

    // Start proxy directly (no subprocess)
    const proxy = new McpProxyServer(
      config.command!,
      config.args!,
      {},
      db,
      config.name
    );

    // Give the proxy a moment to spawn the child
    await new Promise(r => setTimeout(r, 500));

    // Send tools/call requests through the proxy with delays to allow processing
    proxy.handleClientInput(JSON.stringify({
      jsonrpc: '2.0', id: 'c1', method: 'tools/call',
      params: { name: 'echo', arguments: { text: 'hello world' } }
    }) + '\n');
    await new Promise(r => setTimeout(r, 1000));

    proxy.handleClientInput(JSON.stringify({
      jsonrpc: '2.0', id: 'c2', method: 'tools/call',
      params: { name: 'add', arguments: { a: 3, b: 7 } }
    }) + '\n');
    await new Promise(r => setTimeout(r, 1000));

    proxy.handleClientInput(JSON.stringify({
      jsonrpc: '2.0', id: 'c3', method: 'tools/call',
      params: { name: 'search', arguments: { query: 'test query for more tokens' } }
    }) + '\n');
    await new Promise(r => setTimeout(r, 1000));

    // Force DB flush to ensure all writes are persisted
    db.flush();

    // Now verify the cost auditor reads real data from the in-memory DB
    const auditor = new CostAuditor(pricing, db);
    const report = await auditor.auditServer(config);

    // Assertions: proxy must have stored real token data
    expect(report.tokensUsed).toBeGreaterThan(0);
    expect(report.toolBreakdown.length).toBeGreaterThanOrEqual(1);
    expect(report.actualCostUSD).toBeGreaterThan(0);
    expect(report.inputTokens).toBeGreaterThan(0);
    expect(report.outputTokens).toBeGreaterThan(0);

    // Cleanup
    proxy.kill();
    db.close();
  }, 15000);
});