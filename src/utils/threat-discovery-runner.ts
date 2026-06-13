/**
 * Dashboard-triggered Threat Lab and Auto Threat Research jobs (per-tenant).
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DEFAULT_TENANT_ID } from '../tenant/resolve-tenant.js';
import { broadcastDashboardEvent } from './dashboard-events.js';
import {
  REPO_ROOT,
  ensureTenantSwarmDir,
} from './swarm-artifacts.js';
import { getEffectiveSwarmDir } from '../tenant/swarm-tenant-paths.js';

export type ThreatDiscoveryJobKind = 'threat-lab' | 'auto-research';

export interface ThreatDiscoveryJobStatus {
  jobId: string;
  kind: ThreatDiscoveryJobKind;
  tenantId: string;
  state: 'idle' | 'running' | 'done' | 'failed';
  phase: string;
  phaseLabel: string;
  progressPct: number;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  error: string | null;
  logTail: string;
  pid: number | null;
}

const JOB_FILES: Record<ThreatDiscoveryJobKind, string> = {
  'threat-lab': 'threat-lab-job.json',
  'auto-research': 'auto-research-job.json',
};

const LOG_FILES: Record<ThreatDiscoveryJobKind, string> = {
  'threat-lab': 'threat-lab-job.log',
  'auto-research': 'auto-research-job.log',
};

const SCRIPTS: Record<ThreatDiscoveryJobKind, string> = {
  'threat-lab': join(REPO_ROOT, 'scripts', 'security-swarm', 'run-threat-lab.ts'),
  'auto-research': join(REPO_ROOT, 'scripts', 'security-swarm', 'run-auto-threat-research.ts'),
};

const watchedJobs = new Set<string>();
let watchTimer: ReturnType<typeof setInterval> | null = null;
const runningPids = new Map<string, number>();

function jobKey(tenantId: string, kind: ThreatDiscoveryJobKind): string {
  return `${tenantId}:${kind}`;
}

function swarmDir(tenantId: string): string {
  return getEffectiveSwarmDir(tenantId);
}

function jobPath(tenantId: string, kind: ThreatDiscoveryJobKind): string {
  return join(swarmDir(tenantId), JOB_FILES[kind]);
}

function logPath(tenantId: string, kind: ThreatDiscoveryJobKind): string {
  return join(swarmDir(tenantId), LOG_FILES[kind]);
}

function loadJob(tenantId: string, kind: ThreatDiscoveryJobKind): Record<string, unknown> | null {
  const p = jobPath(tenantId, kind);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function writeJob(
  tenantId: string,
  kind: ThreatDiscoveryJobKind,
  patch: Record<string, unknown>,
): void {
  const dir = ensureTenantSwarmDir(tenantId);
  mkdirSync(dir, { recursive: true });
  const existing = loadJob(tenantId, kind) || {};
  writeFileSync(
    jobPath(tenantId, kind),
    JSON.stringify({ ...existing, ...patch, kind, tenantId }, null, 2),
  );
}

function readLogTail(tenantId: string, kind: ThreatDiscoveryJobKind, maxLines = 40): string {
  const p = logPath(tenantId, kind);
  if (!existsSync(p)) return '';
  const lines = readFileSync(p, 'utf-8').split('\n').filter(Boolean);
  return lines.slice(-maxLines).join('\n');
}

function isProcessRunning(pid: number | null | undefined): boolean {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function getThreatDiscoveryJobStatus(
  tenantId: string = DEFAULT_TENANT_ID,
  kind: ThreatDiscoveryJobKind,
): ThreatDiscoveryJobStatus {
  const job = loadJob(tenantId, kind);
  const pid = job?.pid != null ? Number(job.pid) : null;
  let state = (job?.state as ThreatDiscoveryJobStatus['state']) || 'idle';
  if (state === 'running' && pid && !isProcessRunning(pid)) {
    state = job?.exitCode === 0 ? 'done' : 'failed';
  }
  return {
    jobId: String(job?.jobId ?? ''),
    kind,
    tenantId,
    state,
    phase: String(job?.phase ?? ''),
    phaseLabel: String(job?.phaseLabel ?? ''),
    progressPct: Number(job?.progressPct ?? 0),
    startedAt: job?.startedAt ? String(job.startedAt) : null,
    finishedAt: job?.finishedAt ? String(job.finishedAt) : null,
    exitCode: job?.exitCode != null ? Number(job.exitCode) : null,
    error: job?.error ? String(job.error) : null,
    logTail: readLogTail(tenantId, kind),
    pid,
  };
}

export function isThreatDiscoveryJobRunning(
  tenantId: string,
  kind: ThreatDiscoveryJobKind,
): boolean {
  const st = getThreatDiscoveryJobStatus(tenantId, kind);
  return st.state === 'running';
}

function broadcastJobEvent(
  tenantId: string,
  kind: ThreatDiscoveryJobKind,
  type: 'threat-discovery:started' | 'threat-discovery:done' | 'threat-discovery:failed',
  payload: Record<string, unknown>,
): void {
  broadcastDashboardEvent({
    type,
    tenantId,
    payload: { kind, tenantId, ...payload },
    timestamp: Date.now(),
  });
}

function finishJob(
  tenantId: string,
  kind: ThreatDiscoveryJobKind,
  exitCode: number,
  error?: string,
): void {
  const finishedAt = new Date().toISOString();
  writeJob(tenantId, kind, {
    state: exitCode === 0 ? 'done' : 'failed',
    phase: exitCode === 0 ? 'done' : 'failed',
    phaseLabel: exitCode === 0 ? 'Complete' : 'Failed',
    progressPct: exitCode === 0 ? 100 : 0,
    finishedAt,
    exitCode,
    error: error || null,
    pid: null,
  });
  runningPids.delete(jobKey(tenantId, kind));
  watchedJobs.delete(jobKey(tenantId, kind));
  if (exitCode === 0) {
    broadcastJobEvent(tenantId, kind, 'threat-discovery:done', { exitCode });
  } else {
    broadcastJobEvent(tenantId, kind, 'threat-discovery:failed', { exitCode, error });
  }
  if (watchedJobs.size === 0 && watchTimer) {
    clearInterval(watchTimer);
    watchTimer = null;
  }
}

function tickWatchers(): void {
  for (const key of [...watchedJobs]) {
    const [tenantId, kind] = key.split(':') as [string, ThreatDiscoveryJobKind];
    const pid = runningPids.get(key);
    if (pid && isProcessRunning(pid)) continue;
    const job = loadJob(tenantId, kind);
    if (job?.state === 'running') {
      finishJob(tenantId, kind, Number(job.exitCode ?? 1), String(job.error || 'Process exited'));
    }
  }
}

function startWatcher(tenantId: string, kind: ThreatDiscoveryJobKind, pid: number): void {
  const key = jobKey(tenantId, kind);
  watchedJobs.add(key);
  runningPids.set(key, pid);
  if (!watchTimer) {
    watchTimer = setInterval(tickWatchers, 1500);
  }
}

function spawnDiscoveryJob(
  tenantId: string,
  kind: ThreatDiscoveryJobKind,
  extraEnv: Record<string, string>,
): {
  ok: boolean;
  jobId?: string;
  startedAt?: string;
  error?: string;
  status?: number;
} {
  if (isThreatDiscoveryJobRunning(tenantId, kind)) {
    const job = loadJob(tenantId, kind);
    return {
      ok: false,
      error: `${kind} job already running`,
      status: 409,
      jobId: String(job?.jobId ?? ''),
    };
  }

  const script = SCRIPTS[kind];
  if (!existsSync(script)) {
    return { ok: false, error: `${kind} script not found`, status: 500 };
  }

  const jobId = randomUUID();
  const startedAt = new Date().toISOString();
  const outDir = ensureTenantSwarmDir(tenantId);
  const logFile = logPath(tenantId, kind);
  writeFileSync(logFile, `[${startedAt}] Starting ${kind}\n`);

  writeJob(tenantId, kind, {
    jobId,
    state: 'running',
    phase: 'discover',
    phaseLabel: kind === 'threat-lab' ? 'Threat Lab discovery' : 'Auto threat research',
    progressPct: 10,
    startedAt,
    finishedAt: null,
    exitCode: null,
    error: null,
    pid: null,
  });

  broadcastJobEvent(tenantId, kind, 'threat-discovery:started', { jobId, startedAt });

  const child = spawn('node', ['--import', 'tsx/esm', script], {
    cwd: REPO_ROOT,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ...extraEnv,
      MASTYFF_AI_SWARM_DIR: outDir,
      MASTYFF_AI_TENANT_ID: tenantId,
    },
  });

  child.stdout?.on('data', (chunk: Buffer) => {
    appendFileSync(logFile, chunk.toString());
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    appendFileSync(logFile, chunk.toString());
  });

  child.on('exit', (code) => {
    finishJob(tenantId, kind, code ?? 1, code === 0 ? undefined : `${kind} exited ${code}`);
  });

  child.unref();
  writeJob(tenantId, kind, { pid: child.pid ?? null, progressPct: 50 });
  if (child.pid) startWatcher(tenantId, kind, child.pid);

  return { ok: true, jobId, startedAt };
}

export function startThreatLabJob(
  tenantId: string = DEFAULT_TENANT_ID,
  opts: { mode?: 'reactive' | 'proactive' } = {},
): ReturnType<typeof spawnDiscoveryJob> {
  const mode = opts.mode === 'proactive' ? 'proactive' : 'reactive';
  return spawnDiscoveryJob(tenantId, 'threat-lab', {
    SWARM_THREAT_LAB: 'true',
    SWARM_THREAT_LAB_MODE: mode,
    SWARM_THREAT_LAB_REQUIRE_LLM: process.env.SWARM_THREAT_LAB_REQUIRE_LLM ?? 'true',
  });
}

export function startAutoThreatResearchJob(
  tenantId: string = DEFAULT_TENANT_ID,
): ReturnType<typeof spawnDiscoveryJob> {
  return spawnDiscoveryJob(tenantId, 'auto-research', {
    MASTYFF_AI_THREAT_RESEARCH_AUTO: 'true',
    SWARM_THREAT_RESEARCH_AUTO: 'true',
  });
}

/** Test helper — reset watcher state. */
export function resetThreatDiscoveryRunnerForTests(): void {
  watchedJobs.clear();
  runningPids.clear();
  if (watchTimer) {
    clearInterval(watchTimer);
    watchTimer = null;
  }
}
