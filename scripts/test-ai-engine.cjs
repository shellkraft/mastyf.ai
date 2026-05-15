#!/usr/bin/env node
const { execSync } = require('child_process');
const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Adaptive AI-Driven Policy Engine — End-to-End Test');
  console.log('  ' + new Date().toISOString());
  console.log('═══════════════════════════════════════════════════════════\n');

  // ── 1. Load modules ──────────────────────────────────────────────
  const aiDir = join(__dirname, '..', 'dist', 'ai');
  const { DataCollector } = await import(join(aiDir, 'data-collector.js'));
  const { BaselineLearner } = await import(join(aiDir, 'baseline-learner.js'));
  const { CostOptimizer } = await import(join(aiDir, 'cost-optimizer.js'));
  const { ThreatIntel } = await import(join(aiDir, 'threat-intel.js'));
  const { PolicyAssist } = await import(join(aiDir, 'policy-assist.js'));
  const { PatternRecognizer } = await import(join(aiDir, 'pattern-recognizer.js'));
  const { SelfImprovement } = await import(join(aiDir, 'self-improvement.js'));
  const { ComprehensiveReporter } = await import(join(aiDir, 'comprehensive-reporter.js'));
  const { SuggestionEngine } = await import(join(aiDir, 'suggestion-engine.js'));

  const dbDir = join(__dirname, '..', 'dist', 'database');
  const { HistoryDatabase } = await import(join(dbDir, 'history-db.js'));

  // ── 2. Initialize with a throwaway DB (no locks) ──────────────────
  console.log('📦 Initializing database (in-memory)...');
  const db = new HistoryDatabase(':memory:');

  // Seed sample call records
  const now = new Date();
  const sampleRecords = [
    { serverName: 'github-proxy', toolName: 'search_repositories', requestTokens: 41, responseTokens: 1974, totalTokens: 2015, durationMs: 913, timestamp: new Date(now - 60000).toISOString() },
    { serverName: 'github-proxy', toolName: 'search_repositories', requestTokens: 42, responseTokens: 4012, totalTokens: 4054, durationMs: 1494, timestamp: new Date(now - 50000).toISOString() },
    { serverName: 'github-proxy', toolName: 'search_repositories', requestTokens: 41, responseTokens: 4027, totalTokens: 4068, durationMs: 1094, timestamp: new Date(now - 40000).toISOString() },
    { serverName: 'github-proxy', toolName: 'search_code', requestTokens: 42, responseTokens: 28, totalTokens: 70, durationMs: 402, timestamp: new Date(now - 30000).toISOString() },
    { serverName: 'filesystem-proxy', toolName: 'list_directory', requestTokens: 34, responseTokens: 1592, totalTokens: 1626, durationMs: 82, timestamp: new Date(now - 25000).toISOString() },
    { serverName: 'filesystem-proxy', toolName: 'read_text_file', requestTokens: 40, responseTokens: 104, totalTokens: 144, durationMs: 12, timestamp: new Date(now - 20000).toISOString() },
    { serverName: 'filesystem-proxy', toolName: 'read_text_file', requestTokens: 40, responseTokens: 110, totalTokens: 150, durationMs: 8, timestamp: new Date(now - 15000).toISOString() },
    { serverName: 'filesystem-proxy', toolName: 'list_directory', requestTokens: 34, responseTokens: 1572, totalTokens: 1606, durationMs: 2, timestamp: new Date(now - 10000).toISOString() },
  ];

  for (const r of sampleRecords) {
    await db.addCallRecord(r);
  }

  // ── 3. Wire up all modules ───────────────────────────────────────
  console.log('🔧 Wiring SuggestionEngine with all 7 modules...\n');
  const collector = new DataCollector(db);
  const baselineLearner = new BaselineLearner();
  const costOptimizer = new CostOptimizer(db, { getPricingModel: () => 'deepseek-v4-pro' });
  const threatIntel = new ThreatIntel();
  const policyAssist = new PolicyAssist();
  const patternRecognizer = new PatternRecognizer();
  const selfImprovement = new SelfImprovement();

  const engine = new SuggestionEngine(
    collector, baselineLearner, costOptimizer,
    threatIntel, policyAssist, patternRecognizer, selfImprovement,
    { autoApplyThreshold: 0.6, policyOutputPath: '/tmp/ai-test-policy.yaml' }
  );

  // Define servers
  engine.setServers([
    { name: 'github-proxy', transport: 'sse', url: 'http://localhost:9001/sse' },
    { name: 'filesystem-proxy', transport: 'sse', url: 'http://localhost:9002/sse' },
  ]);

  // ── 4. Run learning cycle ────────────────────────────────────────
  console.log('🔄 Running learning cycle...\n');
  const { suggestions, autoApplied, insights, report } = await engine.runLearningCycle();

  // ── 5. Display results ───────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  RESULTS');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`📊 Suggestions generated: ${suggestions.length}`);
  console.log(`✅ Auto-applied (≥${selfImprovement.getAdaptiveThreshold().toFixed(2)}): ${autoApplied.length}`);
  console.log(`🔍 Cross-layer insights: ${insights.length}\n`);

  if (suggestions.length > 0) {
    console.log('── Suggestions ──');
    for (const s of suggestions.slice(0, 8)) {
      const icon = s.confidence >= 0.8 ? '🟢' : s.confidence >= 0.6 ? '🟡' : '🔴';
      console.log(`  ${icon} [${s.source}] ${s.rule.name}`);
      console.log(`      Confidence: ${(s.confidence*100).toFixed(0)}% | ${s.reason}`);
    }
    console.log('');
  }

  if (autoApplied.length > 0) {
    console.log('── Auto-Applied Rules ──');
    for (const s of autoApplied) {
      console.log(`  ✅ ${s.rule.name} → action: ${s.rule.action}, maxTokens: ${s.rule.maxTokens || 'none'}`);
    }
    console.log('');
  }

  // ── 6. Test PolicyAssist (NL → YAML) ──
  console.log('── Policy Assist Demo ──');
  const goals = [
    'block shell execution tools',
    'rate limit file operations to 30 per minute',
    'require admin scope for database tools',
  ];

  for (const goal of goals) {
    const assist = policyAssist.generateRule(goal, ['search_repositories', 'list_directory', 'read_text_file', 'execute_command', 'bash', 'query']);
    if (assist) {
      console.log(`  Goal: "${goal}"`);
      console.log(`  → Rule: ${assist.rule.name} [${assist.rule.action}]`);
      if (assist.rule.tools?.deny) console.log(`    deny: [${assist.rule.tools.deny.join(', ')}]`);
      if (assist.rule.maxCallsPerMinute) console.log(`    maxCallsPerMinute: ${assist.rule.maxCallsPerMinute}`);
      if (assist.rule.rbac?.scopes) console.log(`    rbac.scopes: [${assist.rule.rbac.scopes.join(', ')}]`);
    } else {
      console.log(`  Goal: "${goal}" → No rule generated`);
    }
  }
  console.log('');

  // ── 7. Test ThreatIntel ──
  console.log('── Threat Intel Demo ──');
  const sampleFeed = [
    { id: 'CVE-2026-TEST1', source: 'NVD', severity: 'CRITICAL', affectedPackage: 'mcp-server', signature: '\\bmalicious_command\\b', description: 'Test CVE for demo', remediation: 'Update to v2.0', publishedAt: new Date().toISOString() },
    { id: 'CVE-2026-TEST2', source: 'OSV', severity: 'HIGH', affectedPackage: 'another-pkg', signature: '\\bdangerous\\b', description: 'Test CVE 2', remediation: 'Patch immediately', publishedAt: new Date().toISOString() },
  ];

  // Write temp feed
  const feedPath = '/tmp/ai-test-threat-feed.json';
  writeFileSync(feedPath, JSON.stringify(sampleFeed));
  const threatSuggestions = engine.processThreatFeed(feedPath);
  console.log(`  Processed threat feed: ${threatSuggestions.length} new rules generated`);
  for (const s of threatSuggestions) {
    console.log(`  ⚠️ [${s.confidence}] ${s.rule.name}: ${s.rule.patterns?.join(', ') || 'no patterns'}`);
  }
  console.log('');

  // ── 8. Generate Comprehensive Report ──
  console.log('── Comprehensive Report (Markdown) ──');
  const reporter = new ComprehensiveReporter();
  const md = reporter.toMarkdown(report);
  console.log(md.split('\n').slice(0, 25).join('\n'));
  console.log('  ...\n');

  // ── 9. Self-Improvement Status ──
  console.log('── AI Self-Improvement Status ──');
  const state = selfImprovement.getState();
  console.log(`  Adaptive threshold: ${state.adaptiveThreshold.toFixed(2)}`);
  console.log(`  True positive rate: ${(state.truePositiveRate*100).toFixed(0)}%`);
  console.log(`  False positive rate: ${(state.falsePositiveRate*100).toFixed(0)}%`);
  console.log(`  Module weights: ${JSON.stringify(state.moduleWeights)}`);
  console.log(`  Outcomes tracked: ${state.outcomes.length}`);
  console.log('');

  // ── 10. Pruning ──
  const pruneList = selfImprovement.suggestPruning();
  if (pruneList.length > 0) {
    console.log('── Suggested Rule Pruning ──');
    for (const r of pruneList) console.log(`  🗑️ ${r}`);
  } else {
    console.log('── Pruning: No ineffective rules detected ──');
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  ✅ End-to-end test complete');
  console.log('═══════════════════════════════════════════════════════════');

  db.close();
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});