import { describe, it, expect } from 'vitest';
import { SecurityScanner } from '../../src/services/security-scanner.js';
import { CostAuditor } from '../../src/services/cost-auditor.js';
import { HealthMonitor } from '../../src/services/health-monitor.js';
import { HistoryDatabase } from '../../src/database/history-db.js';
import { PricingClient } from '../../src/clients/pricing-client.js';
import { CveChecker } from '../../src/scanners/cve-checker.js';
import { AuthProber } from '../../src/scanners/auth-prober.js';
import { TypoSquatDetector } from '../../src/scanners/typo-squat-detector.js';
import { SecretScanner } from '../../src/scanners/secret-scanner.js';
import { McpServerConfig } from '../../src/types.js';

describe('Integration: MCP Mastyff AI pipeline tests', () => {
  const config: McpServerConfig = {
    name: 'dummy',
    transport: 'stdio',
    command: 'node',
    args: ['-e', 'require("readline").createInterface({input:process.stdin}).on("line",(l)=>{try{const m=JSON.parse(l);if(m.method==="tools/list"){process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:m.id,result:{tools:[{name:"echo"},{name:"add"}]}})+"\\n")}else if(m.method==="initialize"){process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:m.id,result:{protocolVersion:"2024-11-05",serverInfo:{name:"dummy",version:"1.0.0"},capabilities:{tools:{}}}})+"\\n")}else{process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:m.id,result:{}})+"\\n")}}catch(e){}});setTimeout(()=>{},99999)'],
  };

  const db = new HistoryDatabase(':memory:');
  const pricing = new PricingClient();
  const securityScanner = new SecurityScanner(
    new CveChecker(),
    new AuthProber(),
    new TypoSquatDetector(),
    new SecretScanner()
  );
  const costAuditor = new CostAuditor(pricing, db);
  const healthMonitor = new HealthMonitor(db);

  it('should perform security scan without errors', async () => {
    const result = await securityScanner.scanServer(config);
    expect(result.serverName).toBe('dummy');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.cves).toBeDefined();
  });

  it('should report model-only cost when no proxy call_records', async () => {
    const result = await costAuditor.auditServer(config);
    expect(result.tokensUsed).toBe(0);
    expect(result.estimatedCostUSD).toBe(0);
    expect(result.costSource).toBe('model-only');
    expect(result.toolBreakdown.length).toBe(0);
    expect(result.note).toMatch(/proxy|no proxy traffic/i);
  });

  it('should perform health check against real stdio process', async () => {
    const result = await healthMonitor.checkServer(config);
    expect(result.serverName).toBe('dummy');
    expect(typeof result.latencyMs).toBe('number');
    // Using inline JS command — probes a real spawned Node process
    // that responds to MCP initialize + tools/list
    expect(result.toolCount).toBe(2); // echo + add
  });
});