import { describe, it, expect } from 'vitest';
import { McpProxyServer } from '../../src/proxy/proxy-server.js';
import { HistoryDatabase } from '../../src/database/history-db.js';
import { CostAuditor } from '../../src/services/cost-auditor.js';
import { PricingClient } from '../../src/clients/pricing-client.js';
import { McpServerConfig } from '../../src/types.js';

describe('Proxy-to-Audit Integration', () => {
  const config: McpServerConfig = {
    name: 'test-integration',
    transport: 'stdio',
    command: 'node',
    args: ['-e', 'require("readline").createInterface({input:process.stdin}).on("line",(l)=>{try{const m=JSON.parse(l);if(m.method==="tools/list"){process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:m.id,result:{tools:[{name:"echo"},{name:"add"},{name:"search"}]}})+"\\n")}else if(m.method==="initialize"){process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:m.id,result:{protocolVersion:"2024-11-05",serverInfo:{name:"test",version:"1.0"},capabilities:{tools:{}}}})+"\\n")}else{process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:m.id,result:{content:[{type:"text",text:"response to "+m.method}]}})+"\\n")}}catch(e){process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:m?.id||"unknown",error:{code:-1,message:String(e)}})+"\\n")}});setTimeout(()=>{},99999)'],
  };

  it('should capture real tokens via proxy and produce accurate cost report', async () => {
    process.env.GUARDIAN_MODEL = 'gpt-4o';
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