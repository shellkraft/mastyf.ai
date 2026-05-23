#!/usr/bin/env npx tsx
/**
 * Swarm calibrator — analyze labeled semantic audit outcomes and recommend thresholds.
 * Reads persisted records from PostgreSQL (when configured) and ~/.mcp-guardian JSONL fallback.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  loadSemanticAuditRecordsAsync,
  type StoredSemanticAudit,
} from '../../src/ai/semantic-audit-store.js';
import { isSemanticAuditPostgresEnabled } from '../../src/ai/semantic-audit-pg.js';
import { exitUnlessProFeature } from '../../src/license/enforce-pro.js';

await exitUnlessProFeature('swarm');

const OUT_DIR = join(process.cwd(), 'reports', 'security-swarm');
const LIVE_SESSION = join(
  process.cwd(),
  'scenarios/real-life/output/live-filesystem-session.json',
);
const sinceDays = parseInt(process.env.SWARM_CALIBRATE_DAYS || '7', 10);

type LiveRow = {
  scenario?: string;
  tool?: string;
  expected?: string;
  actual?: string;
  blocked?: boolean;
};

/** When async store is empty, seed from the latest live MCP session (swarm analyze). */
async function seedFromLiveFilesystemSession(): Promise<number> {
  if (process.env.SWARM_CALIBRATE_SEED_FROM_LIVE === 'false') return 0;
  if (!existsSync(LIVE_SESSION)) return 0;

  let live: { proxyResults?: LiveRow[]; burstResults?: LiveRow[]; timestamp?: string };
  try {
    live = JSON.parse(readFileSync(LIVE_SESSION, 'utf-8')) as typeof live;
  } catch {
    return 0;
  }

  const rows = [...(live.proxyResults || []), ...(live.burstResults || [])];
  if (rows.length === 0) return 0;

  const { appendSemanticAuditRecord } = await import('../../src/ai/semantic-audit-store.js');
  const ts = live.timestamp || new Date().toISOString();
  let n = 0;

  for (const r of rows) {
    const suspicious = r.expected === 'block' || r.actual === 'block' || !!r.blocked;
    appendSemanticAuditRecord({
      requestId: `live-${r.scenario || n}`,
      serverName: 'official-filesystem',
      toolName: r.tool || 'unknown',
      syncDecision: {
        action: suspicious ? 'block' : 'pass',
        rule: suspicious ? 'policy-block' : 'allowlist-common-tools',
        reason: `Live scenario ${r.scenario}`,
      },
      semanticAudit: {
        suspicious,
        confidence: suspicious ? 0.88 : 0.18,
        categories: suspicious ? ['prompt-injection'] : ['none'],
        reasoning: `Swarm seed from live MCP (${r.scenario}; expected ${r.expected}, actual ${r.actual})`,
      },
      timestamp: ts,
    });
    n++;
  }

  return n;
}

async function main(): Promise<void> {
  let records = await loadSemanticAuditRecordsAsync({
    sinceMs: sinceDays * 24 * 60 * 60 * 1000,
  });

  if (records.length === 0) {
    const seeded = await seedFromLiveFilesystemSession();
    if (seeded > 0) {
      console.log(`[calibrate] Seeded ${seeded} record(s) from live-filesystem-session.json`);
      records = await loadSemanticAuditRecordsAsync({
        sinceMs: sinceDays * 24 * 60 * 60 * 1000,
      });
    }
  }

  if (process.env.SWARM_CALIBRATE_AUTO_LABEL === 'true') {
    const { labelSemanticAuditRecord } = await import('../../src/ai/semantic-audit-store.js');
    const flaggedUnlabeled = records.filter(
      (r) => r.semanticAudit?.suspicious && !r.labeled,
    );
    for (const r of flaggedUnlabeled.slice(0, 20)) {
      await labelSemanticAuditRecord(r.id, 'true_positive', 'swarm-calibrator');
    }
    if (flaggedUnlabeled.length > 0) {
      records = await loadSemanticAuditRecordsAsync({
        sinceMs: sinceDays * 24 * 60 * 60 * 1000,
      });
    }
  }
  const labeled = records.filter((r) => r.labeled && r.label);
  const flagged = records.filter((r) => r.semanticAudit?.suspicious);

  const fp = labeled.filter((r) => r.label === 'false_positive').length;
  const tp = labeled.filter((r) => r.label === 'true_positive').length;
  const totalLabeled = labeled.length;

  const confidences = flagged.map((r) => r.semanticAudit.confidence).filter((c) => c > 0);
  const avgConfidence =
    confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;

  const currentMin = parseFloat(process.env.GUARDIAN_SEMANTIC_MIN_CONFIDENCE || '0.6');
  const currentLocal = parseFloat(process.env.GUARDIAN_LOCAL_SEMANTIC_THRESHOLD || '0.55');
  let recommendedMin = currentMin;
  let recommendedLocal = currentLocal;
  if (totalLabeled >= 10) {
    const fpRate = fp / totalLabeled;
    if (fpRate > 0.2) {
      recommendedMin = Math.min(0.95, currentMin + 0.05);
      recommendedLocal = Math.min(0.9, currentLocal + 0.04);
    }
    if (fpRate < 0.05 && tp > fp) {
      recommendedMin = Math.max(0.5, currentMin - 0.03);
      recommendedLocal = Math.max(0.45, currentLocal - 0.02);
    }
  }

  const llmConfigured = (await import('../../src/utils/semantic-layer.js')).isSemanticLlmConfigured();
  const emptyReason =
    records.length === 0
      ? llmConfigured
        ? 'No semantic audit outcomes in the last window. Async semantic only persists flagged calls (suspicious + confidence ≥ threshold). Run hybrid proxy traffic, then label via POST /api/learning/label.'
        : 'Semantic LLM not configured (set OPENAI_API_KEY or ANTHROPIC_API_KEY and GUARDIAN_LLM_ENABLED). Async semantic audits will not produce calibration data.'
      : undefined;

  const report = {
    timestamp: new Date().toISOString(),
    windowDays: sinceDays,
    storage: isSemanticAuditPostgresEnabled() ? 'postgres+jsonl' : 'jsonl',
    llmConfigured,
    emptyReason,
    totals: {
      records: records.length,
      flagged: flagged.length,
      labeled: totalLabeled,
      truePositive: tp,
      falsePositive: fp,
    },
    metrics: {
      avgFlagConfidence: Math.round(avgConfidence * 1000) / 1000,
      labeledFpRate: totalLabeled > 0 ? Math.round((fp / totalLabeled) * 1000) / 1000 : null,
    },
    thresholds: {
      current: {
        GUARDIAN_SEMANTIC_MIN_CONFIDENCE: currentMin,
        GUARDIAN_LOCAL_SEMANTIC_THRESHOLD: currentLocal,
      },
      recommended: {
        GUARDIAN_SEMANTIC_MIN_CONFIDENCE: Math.round(recommendedMin * 1000) / 1000,
        GUARDIAN_LOCAL_SEMANTIC_THRESHOLD: Math.round(recommendedLocal * 1000) / 1000,
      },
      note: 'Apply manually or via tenant config; auto-apply requires quorum (GUARDIAN_AI_AUTO_APPLY stays false in prod).',
    },
    profile:
      totalLabeled >= 10 && fp / totalLabeled > 0.15
        ? 'high-paranoia'
        : flagged.length > records.length * 0.1
          ? 'hybrid'
          : 'sync-only',
    sampleFlagged: flagged.slice(-5).map(summarize),
    sampleLabeled: labeled.slice(-5).map(summarize),
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, 'calibration.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log('Semantic calibration report');
  console.log(JSON.stringify(report.totals, null, 2));
  console.log(
    `Recommended GUARDIAN_SEMANTIC_MIN_CONFIDENCE: ${report.thresholds.recommended.GUARDIAN_SEMANTIC_MIN_CONFIDENCE}`,
  );
  console.log(
    `Recommended GUARDIAN_LOCAL_SEMANTIC_THRESHOLD: ${report.thresholds.recommended.GUARDIAN_LOCAL_SEMANTIC_THRESHOLD}`,
  );
  console.log(`Recommended profile: ${report.profile}`);
  console.log(`Written: ${outPath}`);
}

function summarize(r: StoredSemanticAudit) {
  return {
    id: r.id,
    toolName: r.toolName,
    confidence: r.semanticAudit?.confidence,
    label: r.label,
    categories: r.semanticAudit?.categories,
  };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
