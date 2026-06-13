/**
 * Detailed plain-text analysis report (user-facing deep dive).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { resolveSwarmDir } from '../lib/swarm-dir.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dir, '..', '..');
const SWARM_DIR = resolveSwarmDir();
const ANALYSIS_PATH = join(SWARM_DIR, 'analysis.txt');
const LIVE_JSON = join(REPO, 'scenarios', 'real-life', 'output', 'live-filesystem-session.json');
const CONTINUOUS_JSON = join(REPO, 'scenarios', 'real-life', 'output', 'continuous-live-attack-session.json');

function load(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

function gateLine(ok) {
  return ok ? 'PASS' : 'FAIL';
}

function truncate(s, n = 72) {
  if (!s) return '';
  const t = String(s).replace(/\s+/g, ' ');
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function formatDurationMs(ms) {
  if (ms == null || Number.isNaN(ms)) return '—';
  return `${ms} ms`;
}

function sectionLiveMcp(live) {
  const lines = [];
  lines.push('LIVE MCP — OFFICIAL FILESYSTEM (Track B)');
  lines.push('-'.repeat(72));
  if (!live) {
    lines.push('  (skipped — no live-filesystem-session.json)');
    lines.push('');
    return lines;
  }
  lines.push(`  Upstream:     ${live.upstream || '?'}`);
  lines.push(`  Sandbox:      ${live.mcpFsRoot || '?'}`);
  lines.push(`  Profile:      ${live.profile || '?'}`);
  lines.push(`  Timestamp:    ${live.timestamp || '?'}`);
  lines.push(`  Scenarios:    ${live.summary?.scenariosPassed ?? '?'}/${live.summary?.scenariosRun ?? '?'} passed`);
  lines.push(`  Burst runs:   ${live.summary?.burstRuns ?? 0}`);
  lines.push('');
  lines.push('  Tools discovered:');
  for (const t of live.toolsDiscovered || []) {
    lines.push(`    - ${t}`);
  }
  lines.push('');
  lines.push('  Per-scenario results:');
  lines.push('  ' + 'Scenario'.padEnd(22) + 'Tool'.padEnd(18) + 'Exp'.padEnd(8) + 'Act'.padEnd(8) + 'OK'.padEnd(6) + 'Rule');
  lines.push('  ' + '-'.repeat(70));
  for (const r of live.proxyResults || []) {
    lines.push(
      '  '
        + String(r.scenario || '').padEnd(22)
        + String(r.tool || '').padEnd(18)
        + String(r.expected || '').padEnd(8)
        + String(r.actual || '').padEnd(8)
        + (r.ok ? 'yes' : 'no').padEnd(6)
        + truncate(r.rule || '—', 24),
    );
    if (r.error) {
      lines.push(`      error: ${truncate(r.error, 68)}`);
    }
    lines.push(`      latency: ${formatDurationMs(r.durationMs)}`);
  }
  if ((live.burstResults || []).length > 0) {
    lines.push('');
    lines.push(`  Learning burst: ${live.burstResults.length} repeat blocks (instant learning signal)`);
  }
  lines.push('');
  return lines;
}

function sectionContinuousLive(continuous) {
  const lines = [];
  lines.push('CONTINUOUS LIVE ATTACK STREAM (Live MCP traffic)');
  lines.push('-'.repeat(72));
  lines.push('  Note: sca/ and enterprise-attack-sim/ are synthetic — not used here.');
  lines.push('');
  if (!continuous) {
    lines.push('  (skipped — no continuous-live-attack-session.json)');
    lines.push('');
    return lines;
  }
  const s = continuous.summary || {};
  lines.push(`  Duration:       ${continuous.durationMinutes ?? '?'} min`);
  lines.push(`  Total calls:    ${s.totalCalls ?? '?'}`);
  lines.push(`  Attack block:   ${s.attackBlockRate != null ? `${(s.attackBlockRate * 100).toFixed(1)}%` : '?'}`);
  lines.push(`  Benign FP:      ${s.benignFpRate != null ? `${(s.benignFpRate * 100).toFixed(1)}%` : '?'}`);
  lines.push(`  p50 latency:    ${formatDurationMs(s.p50LatencyMs)}`);
  lines.push(`  p95 latency:    ${formatDurationMs(s.p95LatencyMs)}`);
  lines.push(`  Bypasses:       ${s.bypassCount ?? 0}`);
  lines.push(`  Block target:   ${s.meetsBlockTarget ? 'PASS (≥95%)' : 'FAIL (<95%)'}`);
  lines.push(`  FP target:      ${s.meetsFpTarget ? 'PASS (≤2%)' : 'FAIL (>2%)'}`);
  lines.push('');
  if ((continuous.rollingMetrics || []).length) {
    lines.push('  Rolling metrics (5 min):');
    for (const m of continuous.rollingMetrics) {
      lines.push(
        `    ${m.at || '?'} — block ${((m.attackBlockRate ?? 0) * 100).toFixed(1)}%`
        + ` FP ${((m.benignFpRate ?? 0) * 100).toFixed(1)}% p95 ${m.p95LatencyMs}ms`,
      );
    }
    lines.push('');
  }
  if ((continuous.bypasses || []).length) {
    lines.push('  Sample bypasses (first 10):');
    for (const b of continuous.bypasses.slice(0, 10)) {
      lines.push(`    - ${b.fixtureId} (${b.category}) tool=${b.tool}`);
    }
    lines.push('');
  }
  return lines;
}

function sectionLearning(live, cal) {
  const lines = [];
  lines.push('AI LEARNING');
  lines.push('-'.repeat(72));
  const after = live?.learning?.after;
  const pending = after?.pendingSuggestions?.data?.suggestions;
  if (pending?.length) {
    lines.push('  Pending suggestions (review in TUI/dashboard before apply):');
    for (const s of pending.slice(0, 12)) {
      lines.push(
        `    - [${s.source || '?'}] ${s.ruleName || s.id} conf=${s.confidence ?? '?'} — ${truncate(s.reason, 50)}`,
      );
    }
    if (pending.length > 12) lines.push(`    ... and ${pending.length - 12} more`);
  } else {
    lines.push('  Pending suggestions: (none in queue snapshot)');
  }
  lines.push('');
  const state = after?.attackState?.data;
  if (state?.ruleToolCounts) {
    const top = Object.entries(state.ruleToolCounts)
      .sort((a, b) => (b[1].count || 0) - (a[1].count || 0))
      .slice(0, 8);
    lines.push('  Top rule×tool block counts (attack-learning state):');
    for (const [key, v] of top) {
      lines.push(`    - ${key}: ${v.count} blocks`);
    }
  }
  lines.push('');
  if (cal) {
    lines.push('  Semantic calibration (7d window):');
    lines.push(`    records: ${cal.totals?.records ?? 0}  flagged: ${cal.totals?.flagged ?? 0}  labeled: ${cal.totals?.labeled ?? 0}`);
    lines.push(`    TP: ${cal.totals?.truePositive ?? 0}  FP: ${cal.totals?.falsePositive ?? 0}`);
    lines.push(`    recommended profile: ${cal.profile ?? '?'}`);
    lines.push(
      `    MASTYFF_AI_SEMANTIC_MIN_CONFIDENCE: ${cal.thresholds?.current?.MASTYFF_AI_SEMANTIC_MIN_CONFIDENCE ?? '?'} → ${cal.thresholds?.recommended?.MASTYFF_AI_SEMANTIC_MIN_CONFIDENCE ?? '?'}`,
    );
  } else {
    lines.push('  Semantic calibration: (no calibration.json — run pnpm security-swarm:calibrate)');
  }
  lines.push('');
  return lines;
}

function sectionGates(latest) {
  const lines = [];
  lines.push('REGRESSION GATES — SECURITY SWARM (Track A)');
  lines.push('-'.repeat(72));
  if (!latest) {
    lines.push('  (no latest.json — swarm step did not complete)');
    lines.push('');
    return lines;
  }
  const g = latest.gates || {};
  lines.push(`  Overall:        ${gateLine(latest.overall)}`);
  lines.push(`  Mode:           ${latest.mode || '?'}`);
  lines.push(`  Commit:         ${latest.commitSha || '?'}`);
  lines.push(`  Corpus:         ${gateLine(g.corpus)}`);
  lines.push(`  Parity:         ${gateLine(g.parity)}`);
  lines.push(`  Steps:          ${gateLine(g.steps)}`);
  lines.push(`  Scout:          ${gateLine(g.scout !== false)}`);
  lines.push(
    `  Bypasses:       ${g.bypassCount ?? 0} detected, ${g.netNewBypassCount ?? latest.bypasses?.netNew ?? 0} net-new (max ${g.maxBypasses ?? 0})`,
  );
  if (latest.corpus) {
    lines.push('');
    lines.push('  Corpus:');
    lines.push(`    entries: ${latest.corpus.totalEntries}  fn: ${latest.corpus.fn}  fp: ${latest.corpus.fp}`);
    if (latest.corpus.attackBlockRate != null) {
      lines.push(`    attack block rate: ${(latest.corpus.attackBlockRate * 100).toFixed(1)}%`);
    }
    if (latest.corpus.benignPassRate != null) {
      lines.push(`    benign pass rate:  ${(latest.corpus.benignPassRate * 100).toFixed(1)}%`);
    }
  }
  if (latest.parity) {
    lines.push('');
    lines.push('  Parity:');
    lines.push(`    agreement: ${latest.parity.agreement}/${latest.parity.total}`);
    if (latest.parity.agreementRate != null) {
      lines.push(`    rate: ${(latest.parity.agreementRate * 100).toFixed(1)}%`);
    }
  }
  if (latest.timings?.steps?.length) {
    lines.push('');
    lines.push('  Step timings:');
    for (const s of latest.timings.steps) {
      lines.push(`    ${String(s.label).padEnd(32)} ${String(s.elapsedSec).padStart(7)}s`);
    }
    lines.push(`    ${'TOTAL'.padEnd(32)} ${String(latest.timings.totalSec).padStart(7)}s`);
  }
  lines.push('');
  return lines;
}

function sectionFindings(latest) {
  const lines = [];
  lines.push('FINDINGS');
  lines.push('-'.repeat(72));
  const findings = latest?.findings || [];
  if (!findings.length) {
    lines.push('  (none)');
  } else {
    for (const f of findings) {
      lines.push(`  [${f.severity}] ${f.source}: ${f.summary}`);
    }
  }
  lines.push('');
  return lines;
}

function sectionAttackLearning(metrics) {
  const lines = [];
  lines.push('ATTACK-LEARNING REFERENCE (simulated eval)');
  lines.push('-'.repeat(72));
  if (!metrics?.instant || !metrics?.batchOnly) {
    lines.push('  (no reports/attack-learning-eval/metrics.json)');
    lines.push('');
    return lines;
  }
  lines.push(`  Generated: ${metrics.generatedAt || '?'}`);
  lines.push(`  Run type:  ${metrics.runType || '?'}`);
  lines.push('');
  lines.push('  Instant vs batch-only (median time to suggestion):');
  const instMed = (metrics.instant.medianTimeToSuggestionMs || 0) / 1000;
  const batchMed = (metrics.batchOnly.medianTimeToSuggestionMs || 0) / 1000;
  lines.push(`    Instant:    ${instMed.toFixed(1)}s  (avg blocks: ${metrics.instant.avgBlocksToSuggestion ?? '?'})`);
  lines.push(`    Batch-only: ${batchMed >= 3600 ? `${(batchMed / 3600).toFixed(2)}h` : `${batchMed.toFixed(1)}s`}  (avg blocks: ${metrics.batchOnly.avgBlocksToSuggestion ?? '?'})`);
  lines.push('');
  return lines;
}

function sectionArtifacts() {
  const lines = [];
  lines.push('ARTIFACTS INDEX');
  lines.push('-'.repeat(72));
  const paths = [
    ['analysis.txt', ANALYSIS_PATH],
    ['swarm-report.txt', join(SWARM_DIR, 'swarm-report.txt')],
    ['summary.md', join(SWARM_DIR, 'summary.md')],
    ['latest.json', join(SWARM_DIR, 'latest.json')],
    ['live session', LIVE_JSON],
    ['continuous live', CONTINUOUS_JSON],
    ['continuous bypasses', join(SWARM_DIR, 'continuous-bypasses.json')],
    ['calibration.json', join(SWARM_DIR, 'calibration.json')],
    ['job.log', join(SWARM_DIR, 'job.log')],
  ];
  for (const [name, p] of paths) {
    lines.push(`  ${name.padEnd(16)} ${existsSync(p) ? p : '(missing)'}`);
  }
  const figDir = join(SWARM_DIR, 'figures');
  if (existsSync(figDir)) {
    const figs = readdirSync(figDir).filter((f) => f.endsWith('.png'));
    lines.push(`  figures (${figs.length}): ${figDir}/`);
    for (const f of figs.sort()) {
      lines.push(`    - ${f}`);
    }
  }
  lines.push('');
  return lines;
}

function sectionRecommendations(live, latest, cal) {
  const lines = [];
  lines.push('RECOMMENDATIONS');
  lines.push('-'.repeat(72));
  const recs = [];
  if (live && !live.summary?.allPassed) {
    recs.push('Fix failing live MCP scenarios before production rollout.');
  }
  if (latest && (latest.bypasses?.netNew ?? latest.gates?.netNewBypassCount) > 0) {
    recs.push('Review net-new bypasses; run evasion-generate and open swarm/corpus-adv-* PR.');
  }
  if (!cal || (cal.totals?.labeled ?? 0) === 0) {
    recs.push('Enable hybrid semantic + label outcomes via POST /api/learning/label, then re-run calibrate.');
  }
  if (latest && !latest.overall) {
    recs.push('Investigate failed swarm steps in job.log and re-run pnpm security-swarm:fast.');
  }
  const continuous = load(CONTINUOUS_JSON);
  if (continuous && !continuous.summary?.meetsBlockTarget) {
    recs.push('Review continuous-live bypasses in reports/security-swarm/continuous-bypasses.json.');
  }
  if (!recs.length) {
    recs.push('All gates passed. Schedule weekly pnpm security-swarm:analyze and optional full nightly swarm.');
  }
  for (const r of recs) {
    lines.push(`  - ${r}`);
  }
  lines.push('');
  return lines;
}

/**
 * @param {{ liveOk?: boolean, swarmOk?: boolean, startedAt?: string, finishedAt?: string }} meta
 */
export function buildDetailedAnalysisTxt(meta = {}) {
  const latest = load(join(SWARM_DIR, 'latest.json'));
  const live = load(LIVE_JSON);
  const continuous = load(CONTINUOUS_JSON);
  const cal = load(join(SWARM_DIR, 'calibration.json'));
  const metrics = load(join(REPO, 'reports', 'attack-learning-eval', 'metrics.json'));

  let commitSha = latest?.commitSha || 'unknown';
  try {
    commitSha = execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf-8' }).trim();
  } catch {
    /* ignore */
  }

  const liveOk = live?.summary?.allPassed ?? meta.liveOk ?? false;
  const swarmOk = latest?.overall ?? meta.swarmOk ?? false;
  const overallOk = liveOk && swarmOk;

  const hr = '='.repeat(72);
  const lines = [];
  lines.push(hr);
  lines.push('MASTYFF AI — SECURITY SWARM DETAILED ANALYSIS');
  lines.push(hr);
  lines.push('');
  lines.push(`Generated:     ${new Date().toISOString()}`);
  lines.push(`Pipeline start:  ${meta.startedAt || '?'}`);
  lines.push(`Pipeline end:    ${meta.finishedAt || new Date().toISOString()}`);
  lines.push(`Commit:          ${commitSha}`);
  lines.push(`Overall:         ${overallOk ? 'PASS' : 'FAIL'} (live=${liveOk ? 'PASS' : 'FAIL'} swarm=${swarmOk ? 'PASS' : 'FAIL'})`);
  lines.push(`Profile:         ${latest?.recommendedEnvProfile || 'hybrid'}`);
  lines.push('');
  lines.push(...sectionLiveMcp(live));
  lines.push(...sectionContinuousLive(continuous));
  lines.push(...sectionLearning(live, cal));
  lines.push(...sectionGates(latest));
  lines.push(...sectionFindings(latest));
  lines.push(...sectionAttackLearning(metrics));
  lines.push(...sectionArtifacts());
  lines.push(...sectionRecommendations(live, latest, cal));
  lines.push(hr);
  lines.push('End of report — open reports/security-swarm/analysis.txt in your editor.');
  lines.push(hr);
  return lines.join('\n');
}

export function writeDetailedAnalysis(meta = {}) {
  mkdirSync(SWARM_DIR, { recursive: true });
  const text = buildDetailedAnalysisTxt(meta);
  const tsSlug = new Date().toISOString().replace(/[:.]/g, '-');
  const latestPath = join(SWARM_DIR, 'analysis.txt');
  const stampedPath = join(SWARM_DIR, `analysis-${tsSlug}.txt`);
  writeFileSync(latestPath, text);
  writeFileSync(stampedPath, text);
  return { latestPath, stampedPath, text };
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const out = writeDetailedAnalysis();
  console.log(`Wrote ${out.latestPath}`);
}
