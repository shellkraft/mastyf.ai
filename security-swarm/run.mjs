#!/usr/bin/env node
import './lib/gate-pro.mjs';
/**
 * Security Swarm orchestrator — CI + research DAG over adversarial harness, corpus, vitest.
 *
 * Usage:
 *   node security-swarm/run.mjs [--fast] [--live] [--quiet]
 *
 * --live   Stream child output to the terminal in real time (default when stdout is a TTY)
 * --quiet  Capture output (for CI); no live streaming
 * --fast   PR path (~15 min); omit for full nightly swarm
 */
import { runStep, formatStepOutput, STEP_TIMEOUT_MS } from './lib/run-step.mjs';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { synthesizeReport } from './agents/report-synthesize.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dir, '..');
const OUT_DIR = join(REPO, 'reports', 'security-swarm');
const VENV_PY = join(REPO, 'adversarial-harness', '.venv', 'bin', 'python3');

const FAST = process.argv.includes('--fast');
const FORCE_QUIET = process.argv.includes('--quiet');
const FORCE_LIVE = process.argv.includes('--live');
const LIVE = FORCE_LIVE || (!FORCE_QUIET && process.stdout.isTTY);

const gates = JSON.parse(readFileSync(join(__dir, 'config', 'gates.json'), 'utf-8'));
const steps = [];

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

function useColor() {
  return LIVE && process.env.NO_COLOR !== '1';
}

function paint(s, color) {
  return useColor() ? `${color}${s}${c.reset}` : s;
}

function banner(title, sub = '') {
  const line = '═'.repeat(Math.min(72, Math.max(title.length + 4, 40)));
  console.log('');
  console.log(paint(line, c.cyan));
  console.log(paint(`  ${title}`, c.bold + c.cyan));
  if (sub) console.log(paint(`  ${sub}`, c.dim));
  console.log(paint(line, c.cyan));
}

function resolveVenvPython() {
  if (existsSync(VENV_PY)) return VENV_PY;
  const r = runStep('node', ['adversarial-harness/scripts/setup-python-venv.mjs'], {
    cwd: REPO,
    stepKey: 'setup-python-venv',
    live: false,
  });
  const out = (r.stdout || '').trim();
  return out || 'python3';
}

let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;

function run(cmd, args, opts = {}) {
  const label = opts.label ?? [cmd, ...args].join(' ');
  const index = steps.length + 1;
  const total = opts.totalSteps ?? '?';
  const started = Date.now();

  console.log('');
  console.log(
    paint(
      `▶ [${index}/${total}] ${label}`,
      c.bold + c.blue,
    ),
  );
  console.log(paint(`  ${cmd} ${args.join(' ')}`, c.dim));
  console.log(paint(`  started ${new Date().toISOString()}`, c.dim));

  const r = runStep(cmd, args, {
    cwd: opts.cwd ?? REPO,
    label,
    stepKey: label,
    timeoutMs: opts.timeoutMs ?? STEP_TIMEOUT_MS[label],
    live: LIVE,
    env: {
      GUARDIAN_DISABLE_SEMANTIC: opts.semanticOff ? 'true' : process.env.GUARDIAN_DISABLE_SEMANTIC || '',
      GUARDIAN_POLICY_TIMING_ENVELOPE: process.env.GUARDIAN_POLICY_TIMING_ENVELOPE ?? 'false',
      ...opts.env,
    },
  });

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  const timedOut = !!r.timedOut;
  const ok = r.status === 0 && !timedOut;
  const { stdout, stderr } = formatStepOutput(r, LIVE);
  const step = {
    label,
    ok,
    status: timedOut ? 124 : (r.status ?? 1),
    timedOut,
    elapsedSec: parseFloat(elapsed),
    stdout,
    stderr,
  };
  steps.push(step);

  if (ok) {
    consecutiveFailures = 0;
  } else {
    consecutiveFailures++;
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.error(
        paint(
          `✗ Swarm circuit breaker: ${MAX_CONSECUTIVE_FAILURES} consecutive failures — aborting`,
          c.red,
        ),
      );
      writeFileSync(
        join(OUT_DIR, 'steps.json'),
        JSON.stringify({ steps, aborted: true, reason: 'circuit_breaker' }, null, 2),
      );
      process.exit(1);
    }
  }

  console.log(
    ok
      ? paint(`✓ ${label} — PASS (${elapsed}s)`, c.green)
      : paint(
          `✗ ${label} — FAIL (${elapsed}s, exit ${step.status}${timedOut ? ' timeout' : ''})`,
          c.red,
        ),
  );
  if (!ok && !LIVE && step.stderr) {
    console.log(paint(step.stderr, c.red));
  }
  return r;
}

function printFinalSummary(latest) {
  banner('Security Swarm — Final Summary', `mode: ${FAST ? 'fast' : 'full'} · live: ${LIVE}`);
  const rows = [
    ['Corpus', latest.gates?.corpus ? 'PASS' : 'FAIL'],
    ['Parity', latest.gates?.parity ? 'PASS' : 'FAIL'],
    ['Steps', latest.gates?.steps ? 'PASS' : 'FAIL'],
    ['Bypasses', `${latest.gates?.bypassCount ?? 0} (${latest.gates?.netNewBypassCount ?? 0} new)`],
    ['Scout', latest.gates?.scout !== false ? 'PASS' : 'FAIL'],
    ['Overall', latest.overall ? 'PASS' : 'FAIL'],
  ];
  for (const [k, v] of rows) {
    const col = v === 'PASS' ? c.green : v === 'FAIL' ? c.red : c.yellow;
    console.log(`  ${paint(k.padEnd(12), c.bold)} ${paint(v, col)}`);
  }
  if (latest.corpus) {
    console.log(
      paint(
        `  corpus: ${latest.corpus.totalEntries} entries · fn=${latest.corpus.fn} fp=${latest.corpus.fp}`,
        c.dim,
      ),
    );
  }
  if (latest.parity) {
    console.log(
      paint(
        `  parity: ${latest.parity.agreement}/${latest.parity.total} (${((latest.parity.agreementRate ?? 0) * 100).toFixed(1)}%)`,
        c.dim,
      ),
    );
  }
  console.log(paint(`  profile: ${latest.recommendedEnvProfile}`, c.dim));
  console.log(paint(`  report: ${join(OUT_DIR, 'summary.md')}`, c.cyan));
  console.log(paint(`  text:   ${join(OUT_DIR, 'swarm-report.txt')}`, c.cyan));
  console.log('');
}

mkdirSync(OUT_DIR, { recursive: true });

const stepPlan = FAST
  ? ['scout', 'build', 'vitest', 'corpus', 'venv', 'node-tests', 'parity']
  : ['scout', 'build', 'vitest', 'corpus', 'harness-full', 'attack-learning'];
const totalSteps = stepPlan.length;

banner(
  'MCP Guardian — Security Swarm',
  `${FAST ? 'FAST (PR gate)' : 'FULL (nightly)'} · ${LIVE ? 'LIVE streaming' : 'quiet/CI capture'} · ${totalSteps} steps`,
);

run('node', ['security-swarm/agents/scout.mjs'], {
  label: 'scout-audit',
  semanticOff: true,
  totalSteps,
});

run('pnpm', ['build:guardian'], { label: 'pnpm-build', totalSteps });

const vitestArgs = LIVE
  ? ['vitest', 'run', 'tests/policy/', 'tests/proxy/', 'tests/utils/', '--reporter=verbose']
  : ['test:policy-proxy-utils'];
run('pnpm', vitestArgs, { label: 'vitest-policy-proxy-utils', totalSteps });

run('pnpm', ['exec', 'tsx', 'corpus/run-eval.ts'], {
  label: 'corpus-eval',
  totalSteps,
  env: { GUARDIAN_DISABLE_SEMANTIC: 'true' },
});

if (!FAST) {
  run('node', ['adversarial-harness/run-harness.mjs'], {
    label: 'adversarial-harness-full',
    totalSteps,
  });
  run('pnpm', ['eval:attack-learning'], {
    label: 'attack-learning-sim',
    semanticOff: true,
    totalSteps,
  });
} else {
  if (LIVE) {
    run('node', ['adversarial-harness/scripts/setup-python-venv.mjs'], {
      label: 'setup-python-venv',
      totalSteps,
    });
  }
  const venvPython = LIVE ? resolveVenvPython() : resolveVenvPython();
  run('node', ['adversarial-harness/scripts/run-node-tests.mjs'], {
    label: 'harness-node-tests',
    totalSteps,
  });
  run('pnpm', ['exec', 'tsx', 'adversarial-harness/scripts/compare-node-python.ts'], {
    label: 'harness-parity',
    totalSteps,
    env: {
      GUARDIAN_DISABLE_SEMANTIC: 'true',
      PYTHONPATH: join(REPO, 'adversarial-harness', 'python'),
      HARNESS_PYTHON: venvPython,
    },
  });
}

writeFileSync(join(OUT_DIR, 'steps.json'), JSON.stringify({ steps, mode: FAST ? 'fast' : 'full', live: LIVE }, null, 2));

const latest = synthesizeReport({ steps, mode: FAST ? 'fast' : 'full', gates, live: LIVE });

if (!latest.overall && existsSync(join(OUT_DIR, 'bypasses.json'))) {
  const bypassData = JSON.parse(readFileSync(join(OUT_DIR, 'bypasses.json'), 'utf-8'));
  if ((bypassData.count ?? 0) > 0) {
    run('node', ['security-swarm/agents/evasion-generate.mjs'], {
      label: 'evasion-generate',
      totalSteps: totalSteps + 1,
    });
    synthesizeReport({ steps, mode: FAST ? 'fast' : 'full', gates, live: LIVE });
  }
}

printFinalSummary(latest);
process.exit(latest.overall ? 0 : 1);
