/**
 * Personalized traffic summary from history.db (last 7 days).
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { resolveSwarmDir } from '../lib/swarm-dir.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dir, '..', '..');
const SWARM_DIR = resolveSwarmDir();
const OUT_PATH = join(SWARM_DIR, 'traffic-summary.json');

const RULE_GLOSSARY = {
  'request-prompt-injection': 'attempt to override AI instructions in tool arguments',
  'path-traversal': 'path escape outside allowed directories',
  'secret-leak': 'sensitive credential in request or response',
  'sql-injection': 'SQL injection pattern in tool input',
  'shell-injection': 'shell command injection in tool input',
};

function resolveDbPath() {
  return process.env.MASTYFF_AI_DB_PATH || join(homedir(), '.mastyff-ai', 'history.db');
}

function daysAgoMs(days) {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

export async function writeTrafficSummary(opts = {}) {
  const days = opts.days ?? 7;
  const dbPath = opts.dbPath ?? resolveDbPath();
  const sinceMs = daysAgoMs(days);

  mkdirSync(SWARM_DIR, { recursive: true });

  if (!existsSync(dbPath)) {
    const empty = {
      generatedAt: new Date().toISOString(),
      windowDays: days,
      dbPath,
      hasData: false,
      totalCalls: 0,
      totalBlocked: 0,
      servers: [],
      topBlockRules: [],
      note: 'No history.db yet — use IDE MCP tools through Mastyff AI proxy first.',
    };
    writeFileSync(OUT_PATH, JSON.stringify(empty, null, 2));
    return empty;
  }

  let db;
  try {
    const { HistoryDatabase } = await import('../../dist/database/history-db.js');
    db = new HistoryDatabase(dbPath);
    await db.initialize();
  } catch (err) {
    const empty = {
      generatedAt: new Date().toISOString(),
      windowDays: days,
      dbPath,
      hasData: false,
      totalCalls: 0,
      totalBlocked: 0,
      servers: [],
      topBlockRules: [],
      note: `Could not read history.db: ${err instanceof Error ? err.message : String(err)}`,
    };
    writeFileSync(OUT_PATH, JSON.stringify(empty, null, 2));
    return empty;
  }

  const serverNames = await db.getDistinctActiveServers();
  const servers = [];
  let totalCalls = 0;
  let totalBlocked = 0;
  const ruleCounts = new Map();
  const toolCounts = new Map();

  for (const name of serverNames) {
    const records = (await db.getCallRecordsForServer(name)).filter((r) => {
      const t = new Date(r.timestamp || 0).getTime();
      return !Number.isNaN(t) && t >= sinceMs;
    });
    if (!records.length) continue;

    let blocked = 0;
    let costUsd = 0;
    const perTool = new Map();
    const perRule = new Map();
    let lastMs = 0;

    for (const r of records) {
      totalCalls++;
      if (r.blocked) {
        blocked++;
        totalBlocked++;
        const rule = r.blockRule || 'unknown';
        perRule.set(rule, (perRule.get(rule) || 0) + 1);
        ruleCounts.set(rule, (ruleCounts.get(rule) || 0) + 1);
      }
      const tool = r.toolName || '(unknown)';
      perTool.set(tool, (perTool.get(tool) || 0) + 1);
      toolCounts.set(tool, (toolCounts.get(tool) || 0) + 1);
      if (r.costUsd) costUsd += r.costUsd;
      const t = new Date(r.timestamp || 0).getTime();
      if (t > lastMs) lastMs = t;
    }

    servers.push({
      serverName: name,
      calls: records.length,
      blocked,
      passed: records.length - blocked,
      blockRatePct: records.length ? Math.round((blocked / records.length) * 1000) / 10 : 0,
      costUsd: Math.round(costUsd * 1_000_000) / 1_000_000,
      lastSeen: lastMs ? new Date(lastMs).toISOString() : null,
      topTools: [...perTool.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tool, count]) => ({ tool, count })),
      topBlockRules: [...perRule.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([rule, count]) => ({
          rule,
          count,
          plainEnglish: RULE_GLOSSARY[rule] || rule,
        })),
    });
  }

  db.close();

  servers.sort((a, b) => b.calls - a.calls);

  const topBlockRules = [...ruleCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([rule, count]) => ({
      rule,
      count,
      plainEnglish: RULE_GLOSSARY[rule] || rule,
    }));

  const summary = {
    generatedAt: new Date().toISOString(),
    windowDays: days,
    dbPath,
    hasData: totalCalls > 0,
    totalCalls,
    totalBlocked,
    totalPassed: totalCalls - totalBlocked,
    servers,
    topBlockRules,
    topTools: [...toolCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tool, count]) => ({ tool, count })),
  };

  writeFileSync(OUT_PATH, JSON.stringify(summary, null, 2));
  return summary;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeTrafficSummary().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
