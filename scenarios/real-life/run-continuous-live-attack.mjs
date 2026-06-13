#!/usr/bin/env node
/**
 * Continuous live attack stream — corpus + adversarial fixtures through live Mastyff AI proxy
 * and official @modelcontextprotocol/server-filesystem upstream MCP.
 *
 * Dashboard analytics: set MASTYFF_AI_DB_PATH to the same file as dashboard:proxy
 * (e.g. ~/.mastyff-ai/history.db) and REAL_LIFE_METRICS_ENABLED=false to avoid port 9090 clash.
 */
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createLiveProxySession,
  pickTool,
  runOneCall,
  loadLearningSnapshot,
  ROOT,
} from './run-official-filesystem-scenario.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, 'output');
const SESSION_OUT = join(OUT_DIR, 'continuous-live-attack-session.json');
const BYPASSES_OUT = join(ROOT, 'reports', 'security-swarm', 'continuous-bypasses.json');

const DURATION_MIN = Math.min(
  180,
  Math.max(1, parseInt(process.env.LIVE_ATTACK_DURATION_MINUTES || '60', 10)),
);
const INTERVAL_MS = parseInt(process.env.LIVE_ATTACK_INTERVAL_MS || '250', 10);
const BENIGN_RATIO = parseFloat(process.env.LIVE_ATTACK_BENIGN_RATIO || '0.08');
const ESCALATION = process.env.LIVE_ATTACK_ESCALATION !== 'false';
const METRICS_INTERVAL_MS = 5 * 60 * 1000;

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(join(ROOT, 'reports', 'security-swarm'), { recursive: true });

function walkJsonFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walkJsonFiles(p, acc);
    else if (ent.name.endsWith('.json')) acc.push(p);
  }
  return acc;
}

function loadFixturePool() {
  const attacks = [];
  const benign = [];
  const corpusAttacks = walkJsonFiles(join(ROOT, 'corpus', 'attacks'));
  const corpusBenign = walkJsonFiles(join(ROOT, 'corpus', 'benign'));
  const advDir = join(ROOT, 'adversarial-harness', 'fixtures', 'custom-attacks');

  for (const p of corpusAttacks) {
    try {
      const data = JSON.parse(readFileSync(p, 'utf-8'));
      attacks.push({
        ...data,
        id: `corpus:${relative(join(ROOT, 'corpus'), p).replace(/\\/g, '/')}`,
        expected: data.expected || 'block',
      });
    } catch { /* skip */ }
  }

  for (const p of walkJsonFiles(advDir)) {
    try {
      const data = JSON.parse(readFileSync(p, 'utf-8'));
      attacks.push({
        ...data,
        id: `adv:${relative(advDir, p).replace(/\\/g, '/')}`,
        expected: data.expected || 'block',
      });
    } catch { /* skip */ }
  }

  for (const p of corpusBenign) {
    try {
      const data = JSON.parse(readFileSync(p, 'utf-8'));
      benign.push({
        ...data,
        id: `benign:${relative(join(ROOT, 'corpus'), p).replace(/\\/g, '/')}`,
        expected: 'pass',
        category: 'benign',
      });
    } catch { /* skip */ }
  }

  return { attacks, benign };
}

function stringifyArgValue(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** Map corpus/adv fixture tool+args to filesystem MCP tools. */
export function adaptFixture(fixture, toolNames, opts = {}) {
  const readTool = pickTool(toolNames, ['read_text_file', 'read_file', 'read_multiple_files']);
  const writeTool = pickTool(toolNames, ['write_file', 'edit_file']);
  const listTool = pickTool(toolNames, ['list_directory', 'list_directory_with_sizes']);

  const isBenign = fixture.expected === 'pass' || opts.forceBenign;

  if (isBenign) {
    if (listTool) {
      return {
        skipped: false,
        id: fixture.id,
        category: fixture.category || 'benign',
        name: listTool,
        args: { path: 'docs' },
        expect: 'pass',
      };
    }
    if (readTool) {
      return {
        skipped: false,
        id: fixture.id,
        category: fixture.category || 'benign',
        name: readTool,
        args: { path: 'sample.txt' },
        expect: 'pass',
      };
    }
    return { skipped: true, reason: 'no tool for benign', fixtureId: fixture.id };
  }

  const toolName = fixture.toolName || 'read_file';
  const args = fixture.arguments || {};
  const textFields = [
    args.path,
    args.file,
    args.query,
    args.content,
    args.body,
    args.url,
    args.command,
  ].filter(Boolean).map(stringifyArgValue);
  const payload = textFields.join(' ') || stringifyArgValue(args);

  let mappedTool = null;
  let mappedArgs = {};

  const readLike = ['read_file', 'read_text_file', 'read_multiple_files', 'get_file'];
  const writeLike = ['write_file', 'edit_file', 'write', 'create_file'];
  const listLike = ['list_directory', 'list_dir', 'list_directory_with_sizes'];
  const searchLike = ['search', 'grep', 'find', 'query'];

  if (readLike.includes(toolName)) {
    if (!readTool) return { skipped: true, reason: 'no read tool', fixtureId: fixture.id };
    mappedTool = readTool;
    mappedArgs = { path: (args.file || args.path || payload).slice(0, 2000) };
  } else if (writeLike.includes(toolName)) {
    if (writeTool) {
      mappedTool = writeTool;
      mappedArgs = {
        path: (args.path || args.file || 'probe.txt').slice(0, 500),
        content: (args.content || args.body || payload).slice(0, 4000),
      };
    } else if (readTool) {
      mappedTool = readTool;
      mappedArgs = { path: payload.slice(0, 2000) };
    } else {
      return { skipped: true, reason: 'no write/read tool', fixtureId: fixture.id };
    }
  } else if (listLike.includes(toolName) || searchLike.includes(toolName)) {
    if (listTool) {
      mappedTool = listTool;
      mappedArgs = { path: (args.path || args.query || '.').slice(0, 500) };
    } else if (readTool) {
      mappedTool = readTool;
      mappedArgs = { path: (args.query || args.content || args.path || 'sample.txt').slice(0, 2000) };
    } else {
      return { skipped: true, reason: 'no list/read tool', fixtureId: fixture.id };
    }
  } else if (readTool) {
    mappedTool = readTool;
    mappedArgs = { path: payload.slice(0, 2000) };
  } else {
    return { skipped: true, reason: 'unmapped tool', fixtureId: fixture.id };
  }

  return {
    skipped: false,
    id: fixture.id,
    category: fixture.category || fixture.ruleHint || 'unknown',
    name: mappedTool,
    args: mappedArgs,
    expect: fixture.expected === 'pass' ? 'pass' : 'block',
  };
}

function mutateForEscalation(scenario) {
  const zwj = '\u200d';
  const args = { ...scenario.args };
  if (args.path) {
    args.path = `${zwj}${args.path}${zwj}`;
  } else if (args.content) {
    args.content = `Ignоre ${zwj} ${args.content}`;
  }
  return { ...scenario, args, id: `${scenario.id}:esc`, phase: 'escalation' };
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function computeMetrics(results) {
  const evaluated = results.filter((r) => !r.skipped);
  const attacks = evaluated.filter((r) => r.expected === 'block');
  const benign = evaluated.filter((r) => r.expected === 'pass');
  const attackBlocked = attacks.filter((r) => r.blocked).length;
  const benignPassed = benign.filter((r) => r.ok).length;
  const latencies = evaluated.map((r) => r.durationMs).filter((n) => n != null).sort((a, b) => a - b);

  const learningState = loadLearningSnapshot();
  const suggestionCount =
    learningState.pendingSuggestions?.data?.suggestions?.length ?? 0;
  const blockCountEntries = learningState.attackState?.data?.ruleToolCounts
    ? Object.values(learningState.attackState.data.ruleToolCounts)
        .reduce((s, v) => s + (v.count || 0), 0)
    : 0;

  return {
    totalCalls: evaluated.length,
    skipped: results.filter((r) => r.skipped).length,
    attackCalls: attacks.length,
    attackBlockRate: attacks.length ? attackBlocked / attacks.length : null,
    benignCalls: benign.length,
    benignFpRate: benign.length ? 1 - benignPassed / benign.length : null,
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    instantLearningBlocks: blockCountEntries,
    pendingSuggestions: suggestionCount,
  };
}

function pickNextFixture(attackQueue, benignPool, callIndex) {
  const useBenign = benignPool.length > 0 && Math.random() < BENIGN_RATIO;
  if (useBenign) {
    return benignPool[callIndex % benignPool.length];
  }
  if (!attackQueue.length) return null;
  return attackQueue[callIndex % attackQueue.length];
}

export async function runContinuousLiveAttack(opts = {}) {
  const durationMin = opts.durationMinutes ?? DURATION_MIN;
  const endAt = Date.now() + durationMin * 60 * 1000;

  const { attacks, benign } = loadFixturePool();
  const session = await createLiveProxySession();
  const { proc, responses, toolNames } = session;

  if (!toolNames.length) {
    await session.drainAndKill();
    throw new Error('tools/list returned no tools');
  }

  const adaptedAttacks = [];
  const skippedFixtures = [];
  for (const f of attacks) {
    const adapted = adaptFixture(f, toolNames);
    if (adapted.skipped) {
      skippedFixtures.push({ fixtureId: f.id, reason: adapted.reason });
    } else {
      adaptedAttacks.push(adapted);
    }
  }

  const adaptedBenign = [];
  for (const f of benign) {
    const adapted = adaptFixture(f, toolNames);
    if (!adapted.skipped) adaptedBenign.push(adapted);
  }

  const results = [];
  const rollingMetrics = [];
  let callIndex = 0;
  let phase = 'corpus-pass';
  let escalationQueue = [];
  let lastMetricsAt = Date.now();
  let nextCallId = 1;

  console.log(`Continuous live attack: ${durationMin} min, ${adaptedAttacks.length} attacks, ${adaptedBenign.length} benign mapped, ${skippedFixtures.length} skipped`);

  while (Date.now() < endAt) {
    if (phase === 'corpus-pass' && callIndex >= adaptedAttacks.length * 2 && ESCALATION) {
      phase = 'escalation';
      const blocked = results.filter((r) => r.expected === 'block' && r.blocked && !r.skipped);
      const seeds = blocked.slice(0, 40);
      escalationQueue = seeds.map((r) => mutateForEscalation({
        id: r.fixtureId,
        category: r.category,
        name: r.tool,
        args: r.arguments,
        expect: 'block',
      }));
      console.log(`Phase escalation: ${escalationQueue.length} mutated repeats`);
    }

    let scenario;
    if (phase === 'escalation' && escalationQueue.length) {
      scenario = escalationQueue[callIndex % escalationQueue.length];
    } else {
      const raw = pickNextFixture(adaptedAttacks, adaptedBenign, callIndex);
      if (!raw) break;
      scenario = raw;
    }

    const callId = `c${nextCallId++}`;
    const t0 = Date.now();
    const row = await runOneCall(proc, responses, scenario, callId);
    results.push({
      fixtureId: scenario.id,
      category: scenario.category,
      phase,
      timestamp: new Date().toISOString(),
      tool: row.tool,
      arguments: row.arguments,
      expected: row.expected,
      actual: row.actual,
      blocked: row.blocked,
      ok: row.ok,
      durationMs: row.durationMs,
      rule: row.rule,
      error: row.error,
      skipped: false,
    });

    callIndex++;

    if (Date.now() - lastMetricsAt >= METRICS_INTERVAL_MS) {
      const snap = computeMetrics(results);
      snap.at = new Date().toISOString();
      snap.elapsedMin = Math.round((Date.now() - (endAt - durationMin * 60 * 1000)) / 60000);
      rollingMetrics.push(snap);
      console.log(
        `[metrics ${snap.elapsedMin}m] attacks blocked ${((snap.attackBlockRate ?? 0) * 100).toFixed(1)}%`
        + ` FP ${((snap.benignFpRate ?? 0) * 100).toFixed(1)}%`
        + ` p95 ${snap.p95LatencyMs}ms`,
      );
      lastMetricsAt = Date.now();
    }

    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }

  await session.drainAndKill();

  const finalMetrics = computeMetrics(results);
  const bypasses = results.filter(
    (r) => !r.skipped && r.expected === 'block' && !r.blocked,
  );

  const report = {
    timestamp: new Date().toISOString(),
    upstream: '@modelcontextprotocol/server-filesystem',
    profile: 'hybrid',
    durationMinutes: durationMin,
    toolsDiscovered: toolNames,
    fixtureCounts: {
      attacksLoaded: attacks.length,
      attacksMapped: adaptedAttacks.length,
      benignMapped: adaptedBenign.length,
      skipped: skippedFixtures.length,
    },
    skippedFixtures: skippedFixtures.slice(0, 100),
    summary: {
      totalCalls: finalMetrics.totalCalls,
      attackBlockRate: finalMetrics.attackBlockRate,
      benignFpRate: finalMetrics.benignFpRate,
      p50LatencyMs: finalMetrics.p50LatencyMs,
      p95LatencyMs: finalMetrics.p95LatencyMs,
      bypassCount: bypasses.length,
      meetsBlockTarget: (finalMetrics.attackBlockRate ?? 0) >= 0.95,
      meetsFpTarget: (finalMetrics.benignFpRate ?? 0) <= 0.02,
    },
    rollingMetrics,
    results: results.slice(-5000),
    bypasses: bypasses.map((b) => ({
      fixtureId: b.fixtureId,
      category: b.category,
      phase: b.phase,
      tool: b.tool,
      rule: b.rule,
    })),
    learning: { after: loadLearningSnapshot() },
    note: 'Live MCP traffic — not synthetic sca/ simulator',
  };

  writeFileSync(SESSION_OUT, JSON.stringify(report, null, 2));

  if (bypasses.length && (finalMetrics.attackBlockRate ?? 0) < 0.95) {
    writeFileSync(BYPASSES_OUT, JSON.stringify({
      generatedAt: report.timestamp,
      attackBlockRate: finalMetrics.attackBlockRate,
      bypasses: report.bypasses,
      triage: 'Review against security-swarm/config/bypass-baseline.json; open swarm/corpus-adv-* PR if net-new.',
    }, null, 2));
  }

  return report;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runContinuousLiveAttack()
    .then((report) => {
      console.log(JSON.stringify({
        ok: report.summary.meetsBlockTarget && report.summary.meetsFpTarget,
        out: SESSION_OUT,
        summary: report.summary,
      }, null, 2));
      process.exit(
        report.summary.meetsBlockTarget && report.summary.meetsFpTarget ? 0 : 1,
      );
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
