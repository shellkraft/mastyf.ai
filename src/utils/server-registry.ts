/**
 * Mastyff AI server registry: mastyff-ai-configs + history.db metrics.
 */
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { createDatabase } from '../database/create-database.js';
import { resolveMastyffAiDbPath } from './mastyff-ai-db-path.js';
import {
  getAllActiveServerNames,
  loadAllCallRecords,
  summarizeRecords,
} from './db-aggregate.js';
import { ConfigParser } from '../config-parser.js';
import { readOnboardArtifact } from '../cli/onboard.js';
import { REPO_ROOT } from './swarm-artifacts.js';
import { getEffectiveSwarmDir } from '../tenant/swarm-tenant-paths.js';
import { DEFAULT_TENANT_ID } from '../tenant/resolve-tenant.js';

export interface ServerRegistryEntry {
  name: string;
  configPath: string;
  transport: string;
  command?: string;
  wrapped: boolean;
  metrics?: {
    totalCalls: number;
    blocked: number;
    passed: number;
    lastSeen: string | null;
    topTools: Array<{ tool: string; count: number }>;
  };
}

export interface OnboardingStatus {
  onboarded: boolean;
  onboardedAt: string | null;
  client: string | null;
  wrapApplied: boolean;
  configsDir: string | null;
  configCount: number;
  hasTraffic: boolean;
  totalCalls: number;
  lastAnalysisAt: string | null;
  lastAnalysisState: string | null;
  dbPath: string;
  commands: {
    onboard: string;
    dashboardProxy: string;
    runAnalysis: string;
  };
}

function listMastyffAiConfigPaths(configsDir: string): string[] {
  if (!existsSync(configsDir)) return [];
  return readdirSync(configsDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => join(configsDir, f));
}

function topTools(records: import('../types.js').ProxyCallRecord[], limit = 5): Array<{ tool: string; count: number }> {
  const counts = new Map<string, number>();
  for (const r of records) {
    const t = r.toolName || '(unknown)';
    counts.set(t, (counts.get(t) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tool, count]) => ({ tool, count }));
}

export async function getServerRegistry(projectRoot = REPO_ROOT): Promise<ServerRegistryEntry[]> {
  const configsDir = join(projectRoot, 'mastyff-ai-configs');
  const paths = listMastyffAiConfigPaths(configsDir);
  const dbPath = resolveMastyffAiDbPath();
  const db = await createDatabase(dbPath);
  await db.initialize();

  const activeNames = await getAllActiveServerNames(db);
  const allRecords = await loadAllCallRecords(db, activeNames);
  await db.close();

  const entries: ServerRegistryEntry[] = [];
  for (const configPath of paths) {
    try {
      const servers = ConfigParser.parse(configPath);
      for (const s of servers) {
        const recs = allRecords.filter((r) => r.serverName === s.name);
        const sum = summarizeRecords(recs);
        let lastMs = 0;
        for (const r of recs) {
          const t = new Date(r.timestamp || 0).getTime();
          if (!Number.isNaN(t) && t > lastMs) lastMs = t;
        }
        entries.push({
          name: s.name,
          configPath,
          transport: s.transport || (s.url ? 'sse' : 'stdio'),
          command: s.command,
          wrapped: true,
          metrics: recs.length
            ? {
                totalCalls: sum.total,
                blocked: sum.blocked,
                passed: sum.passed,
                lastSeen: lastMs ? new Date(lastMs).toISOString() : null,
                topTools: topTools(recs),
              }
            : undefined,
        });
      }
    } catch {
      /* skip malformed config */
    }
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getOnboardingStatus(projectRoot = REPO_ROOT): Promise<OnboardingStatus> {
  const onboard = readOnboardArtifact();
  const configsDir = join(projectRoot, 'mastyff-ai-configs');
  const configCount = listMastyffAiConfigPaths(configsDir).length;
  const dbPath = resolveMastyffAiDbPath();

  let totalCalls = 0;
  let hasTraffic = false;
  try {
    const db = await createDatabase(dbPath);
    await db.initialize();
    const names = await getAllActiveServerNames(db);
    const recs = await loadAllCallRecords(db, names);
    totalCalls = recs.length;
    hasTraffic = totalCalls > 0;
    await db.close();
  } catch {
    /* db may not exist yet */
  }

  let lastAnalysisAt: string | null = null;
  let lastAnalysisState: string | null = null;
  const jobPath = join(getEffectiveSwarmDir(DEFAULT_TENANT_ID), 'job.json');
  if (existsSync(jobPath)) {
    try {
      const job = JSON.parse(readFileSync(jobPath, 'utf-8')) as Record<string, unknown>;
      lastAnalysisAt = job.finishedAt ? String(job.finishedAt) : job.startedAt ? String(job.startedAt) : null;
      lastAnalysisState = job.state ? String(job.state) : null;
    } catch {
      /* ignore */
    }
  }

  return {
    onboarded: !!onboard,
    onboardedAt: onboard?.onboardedAt ?? null,
    client: onboard?.client ?? null,
    wrapApplied: onboard?.applied ?? false,
    configsDir: existsSync(configsDir) ? configsDir : null,
    configCount,
    hasTraffic,
    totalCalls,
    lastAnalysisAt,
    lastAnalysisState,
    dbPath,
    commands: {
      onboard: 'pnpm onboard -- --client cursor --apply',
      dashboardProxy: 'mastyff-ai start',
      runAnalysis: 'pnpm security-swarm:analyze',
    },
  };
}
