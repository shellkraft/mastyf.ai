/**
 * Benchmark: Threat Prediction Computation Performance
 *
 * Measures risk scoring and forecast generation across many servers.
 *
 * Run: pnpm tsx benchmarks/agentic-threat-prediction.ts
 */

import { RiskScorer } from '../src/agentic/threat-prediction/risk-scorer.js';
import { ThreatPredictor } from '../src/agentic/threat-prediction/predictor.js';
import type { McpServerConfig } from '../src/types.js';

function generateServer(name: string, transport: McpServerConfig['transport'], pkg: string, cveCount: number): McpServerConfig {
  return { name, transport, packageName: pkg, command: 'node', args: ['-e', 'console.log(1)'] };
}

async function benchmark(): Promise<void> {
  console.log('=== Threat Prediction Benchmark ===\n');

  const scorer = new RiskScorer();
  const predictor = new ThreatPredictor();

  const serverConfigs: Array<{ server: McpServerConfig; cves: number; maxCvss: number }> = [
    { server: generateServer('safe-stdio', 'stdio', '@modelcontextprotocol/sdk', 0), cves: 0, maxCvss: 0 },
    { server: generateServer('medium-sse', 'sse', 'mcp-server-github', 2), cves: 2, maxCvss: 6.5 },
    { server: generateServer('danger-http', 'sse', 'mcp-shell-server', 5), cves: 5, maxCvss: 9.5 },
    { server: generateServer('filesystem', 'stdio', 'filesystem-mcp-server', 1), cves: 1, maxCvss: 7.2 },
    { server: generateServer('slack-sse', 'sse', 'mcp-server-slack', 1), cves: 1, maxCvss: 5.0 },
  ];

  const serverCounts = [1, 5, 10, 50, 100, 500, 1000];
  const allConfigs = Array.from({ length: 1000 }, (_, i) => {
    const base = serverConfigs[i % serverConfigs.length]!;
    return {
      server: generateServer(base.server.name + '-' + i, base.server.transport, base.server.packageName || '', base.cves),
      cves: base.cves,
      maxCvss: base.maxCvss,
    };
  });

  for (const count of serverCounts) {
    const subset = allConfigs.slice(0, count);
    const t0 = Date.now();
    for (const { server, cves, maxCvss } of subset) {
      const risk = scorer.scoreServer(server, cves, maxCvss);
      predictor.forecast(risk, cves);
    }
    const elapsed = Date.now() - t0;
    const perServer = (elapsed / count).toFixed(3);
    console.log('Servers: ' + count + ' | Total: ' + elapsed + 'ms | Per-server: ' + perServer + 'ms');
  }

  console.log('\nDone.');
}

benchmark().catch(console.error);