/**
 * Benchmark: Agentic Policy Generation Performance
 *
 * Measures the latency of policy synthesis under various observation sizes.
 *
 * Run: pnpm tsx benchmarks/agentic-policy-gen.ts
 */

import { BehaviorCollector, type ToolCallObservation } from '../src/agentic/policy-gen/behavior-collector.js';
import { PatternAnalyzer } from '../src/agentic/policy-gen/pattern-analyzer.js';
import { PolicySynthesizer } from '../src/agentic/policy-gen/policy-synthesizer.js';
import { PolicyDiff } from '../src/agentic/policy-gen/policy-diff.js';

const TOOLS = ['read_file', 'write_file', 'execute_command', 'search', 'query_db', 'send_message', 'list_files', 'delete_file', 'create_pr', 'deploy'];
const SERVERS = ['filesystem', 'github', 'slack', 'database', 'shell'];

function generateObservations(count: number): ToolCallObservation[] {
  const obs: ToolCallObservation[] = [];
  for (let i = 0; i < count; i++) {
    obs.push({
      toolName: TOOLS[i % TOOLS.length]!,
      serverName: SERVERS[i % SERVERS.length]!,
      argumentKeys: ['path', 'content'] as string[],
      argumentTypes: { path: 'string', content: 'string' } as Record<string, string>,
      argumentRanges: { path: { min: 5, max: 100, avg: 20 }, content: { min: 10, max: 10000, avg: 500 } },
      timestamp: Date.now() + i * 1000,
      latencyMs: 20 + Math.random() * 200,
      success: Math.random() > 0.05,
      sessionHash: `session-${i % 10}`,
    });
  }
  return obs;
}

async function benchmark() {
  console.log('=== Agentic Policy Generation Benchmark ===\n');

  const sizes = [10, 100, 1_000, 10_000, 100_000];

  for (const size of sizes) {
    const collector = new BehaviorCollector();
    const analyzer = new PatternAnalyzer();
    const synthesizer = new PolicySynthesizer();
    const differ = new PolicyDiff();

    collector.startWindow(`bench-${size}`);

    const observations = generateObservations(size);
    const t0 = Date.now();

    for (const obs of observations) {
      collector.record(obs);
    }

    const recTime = Date.now() - t0;
    const window = collector.finalizeWindow()!;
    const finalizeTime = Date.now() - t0 - recTime;

    // Analysis
    const a0 = Date.now();
    const analysis = analyzer.analyze(window, window.stats);
    const analysisTime = Date.now() - a0;

    // Synthesis
    const s0 = Date.now();
    const policy = synthesizer.synthesize(analysis);
    const synthTime = Date.now() - s0;

    // Diff
    const d0 = Date.now();
    differ.diff(policy, policy.yaml);
    const diffTime = Date.now() - d0;

    console.log(`Size: ${size}`);
    console.log(`  Record:         ${recTime}ms`);
    console.log(`  Finalize:       ${finalizeTime}ms`);
    console.log(`  Analyze:        ${analysisTime}ms`);
    console.log(`  Synthesize:     ${synthTime}ms`);
    console.log(`  Diff:           ${diffTime}ms`);
    console.log(`  Total:          ${recTime + finalizeTime + analysisTime + synthTime + diffTime}ms`);
    console.log(`  Policy lines:   ${policy.yaml.split('\n').length}`);
    console.log(`  Confidence:     ${(policy.confidence * 100).toFixed(0)}%`);
    console.log(`  Memory:         ~${Math.round((JSON.stringify(observations).length) / 1024)}KB (raw data)`);
    console.log('');
  }
}

benchmark().catch(console.error);