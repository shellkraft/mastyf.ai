/**
 * Shared job state for security-swarm analysis (CLI + dashboard API).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { REPO_ROOT, resolveSwarmDir } from './swarm-dir.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
/** Override via MASTYFF_AI_SWARM_DIR for per-tenant dashboard runs. */
export { REPO_ROOT };
export const SWARM_DIR = resolveSwarmDir();
export const JOB_PATH = join(SWARM_DIR, 'job.json');
export const JOB_LOG_PATH = join(SWARM_DIR, 'job.log');
export const ANALYSIS_PATH = join(SWARM_DIR, 'analysis.txt');

export const PHASES = [
  { id: 'preflight', label: 'Preflight checks', progressPct: 5 },
  { id: 'build', label: 'Build', progressPct: 10 },
  { id: 'live-mcp', label: 'Live filesystem MCP', progressPct: 25 },
  { id: 'user-servers', label: 'Your MCP servers', progressPct: 35 },
  { id: 'traffic', label: 'Traffic summary', progressPct: 42 },
  { id: 'calibrate', label: 'Semantic calibration', progressPct: 50 },
  { id: 'swarm', label: 'Security swarm gates', progressPct: 75 },
  { id: 'visuals', label: 'Generate figures', progressPct: 88 },
  { id: 'report', label: 'Plain-English report', progressPct: 95 },
  { id: 'analysis', label: 'Technical appendix', progressPct: 100 },
];

export function loadJob() {
  if (!existsSync(JOB_PATH)) return null;
  try {
    return JSON.parse(readFileSync(JOB_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

export function writeJob(patch) {
  mkdirSync(SWARM_DIR, { recursive: true });
  const prev = loadJob() || {};
  const next = {
    jobId: prev.jobId || randomUUID(),
    state: 'idle',
    phase: '',
    phaseLabel: '',
    progressPct: 0,
    startedAt: null,
    finishedAt: null,
    exitCode: null,
    error: null,
    analysisPath: ANALYSIS_PATH,
    ...prev,
    ...patch,
  };
  writeFileSync(JOB_PATH, JSON.stringify(next, null, 2));
  return next;
}

export function appendJobLog(line) {
  mkdirSync(SWARM_DIR, { recursive: true });
  appendFileSync(JOB_LOG_PATH, `${line}\n`, 'utf-8');
}

export function readLogTail(maxLines = 40) {
  if (!existsSync(JOB_LOG_PATH)) return '';
  const lines = readFileSync(JOB_LOG_PATH, 'utf-8').split('\n').filter(Boolean);
  return lines.slice(-maxLines).join('\n');
}

export function phaseById(id) {
  return PHASES.find((p) => p.id === id) || { id, label: id, progressPct: 0 };
}
