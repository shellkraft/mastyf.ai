import { DataFetcher } from '../src/tui/data-fetcher.js';

async function main() {
  const fetcher = new DataFetcher();
  await fetcher.fetchAll();
  const d = fetcher.getData();
  if (d) {
    console.log('✅ Total Requests:', d.overview.totalRequests);
    console.log('💰 Total Cost USD:', d.overview.totalCostUsd.toFixed(4));
    console.log('⏱️  Avg Latency ms:', d.overview.avgLatencyMs);
    console.log('🔒 Security Score:', d.security.overallScore);
    console.log('🦠 Threats:', d.ai.threats.length);
    console.log('🧠 TPR:', d.ai.learningState.truePositiveRate);
    console.log('🧠 FPR:', d.ai.learningState.falsePositiveRate);
    console.log('🧠 Threshold:', d.ai.learningState.adaptiveThreshold);
    console.log('📋 Audit Events:', d.audit.total);
    console.log('🖥️  Instances:', d.instances.length);
    console.log('');
    console.log('=== Cost Per Server ===');
    for (const c of d.cost.servers) {
      console.log(`  ${c.name}: ${c.tokens.toLocaleString()} tokens, $${c.cost.toFixed(4)}`);
    }
    console.log('');
    console.log('=== Health Per Server ===');
    for (const h of d.health.servers) {
      console.log(`  ${h.name}: ${h.latency}ms, ${h.successRate.toFixed(0)}% success`);
    }
    console.log('');
    console.log('=== Threats ===');
    for (const t of d.ai.threats.slice(0, 3)) {
      console.log(`  ${t.id} (${t.source} - ${t.severity})`);
    }
    if (d.ai.threats.length > 3) console.log(`  ... and ${d.ai.threats.length - 3} more`);
  } else {
    console.log('❌ Cache is null');
  }
  fetcher.stop();
}

main().catch(console.error);