/**
 * Compliance Copilot — full control catalog + auditor export.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { StoredSemanticAudit } from './semantic-audit-store.js';
import { loadSemanticAuditRecordsAsync } from './semantic-audit-store.js';
import { LlmAssistant } from './llm-assistant.js';
import { Logger } from '../utils/logger.js';

export type ControlMapping = {
  controlId: string;
  framework: 'NIST-CSF' | 'SOC2' | 'CIS';
  title: string;
  evidenceRules: string[];
  eventCount: number;
  sampleRecordIds: string[];
};

type CatalogEntry = { title: string; keywords: string[] };

type ComplianceCatalog = {
  frameworks: Record<string, Record<string, CatalogEntry>>;
};

export type ComplianceReport = {
  generatedAt: string;
  windowDays: number;
  totalEvents: number;
  blockedCount: number;
  semanticFlagCount: number;
  controlMappings: ControlMapping[];
  topAttackClasses: Array<{ category: string; count: number }>;
  briefing?: string;
  exportFormats: { markdown: string; json: string };
};

function loadComplianceCatalog(): ComplianceCatalog {
  const path = join(process.cwd(), 'config', 'compliance-control-catalog.json');
  if (!existsSync(path)) return { frameworks: {} };
  return JSON.parse(readFileSync(path, 'utf-8')) as ComplianceCatalog;
}

function matchControls(text: string, catalog: ComplianceCatalog): Array<Omit<ControlMapping, 'eventCount' | 'evidenceRules' | 'sampleRecordIds'>> {
  const lower = text.toLowerCase();
  const out: Array<Omit<ControlMapping, 'eventCount' | 'evidenceRules' | 'sampleRecordIds'>> = [];
  for (const [framework, controls] of Object.entries(catalog.frameworks)) {
    for (const [controlId, entry] of Object.entries(controls)) {
      if (entry.keywords.some((k) => lower.includes(k.toLowerCase()))) {
        out.push({
          controlId,
          framework: framework as ControlMapping['framework'],
          title: entry.title,
        });
      }
    }
  }
  return out;
}

function aggregateControls(records: StoredSemanticAudit[], catalog: ComplianceCatalog): ControlMapping[] {
  const byKey = new Map<string, ControlMapping>();

  for (const rec of records) {
    const parts = [
      rec.syncDecision?.rule || '',
      rec.semanticAudit?.categories?.join(' ') || '',
      rec.toolName,
      rec.semanticAudit?.reasoning || '',
    ].join(' ');
    const matches = matchControls(parts, catalog);
    for (const m of matches) {
      const key = `${m.framework}:${m.controlId}`;
      const rule = rec.syncDecision?.rule || rec.semanticAudit?.categories?.[0] || 'semantic-flag';
      const cur = byKey.get(key) || {
        ...m,
        evidenceRules: [],
        eventCount: 0,
        sampleRecordIds: [],
      };
      cur.eventCount += 1;
      if (!cur.evidenceRules.includes(rule)) cur.evidenceRules.push(rule);
      if (cur.sampleRecordIds.length < 5) cur.sampleRecordIds.push(rec.id);
      byKey.set(key, cur);
    }
  }

  return [...byKey.values()].sort((a, b) => b.eventCount - a.eventCount);
}

function topAttackClasses(records: StoredSemanticAudit[]): ComplianceReport['topAttackClasses'] {
  const counts = new Map<string, number>();
  for (const r of records) {
    if (!r.semanticAudit?.suspicious) continue;
    const cat = r.semanticAudit.categories?.[0] || 'unknown';
    counts.set(cat, (counts.get(cat) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

export function formatComplianceMarkdown(report: ComplianceReport): string {
  const lines = [
    `# MCP Mastyff AI Compliance Briefing`,
    ``,
    `Generated: ${report.generatedAt}`,
    `Window: ${report.windowDays} days`,
    ``,
    `## Executive summary`,
    report.briefing || '',
    ``,
    `## Metrics`,
    `- Total audited events: ${report.totalEvents}`,
    `- Policy blocks: ${report.blockedCount}`,
    `- Semantic flags: ${report.semanticFlagCount}`,
    ``,
    `## Control mappings`,
    ...report.controlMappings.map(
      (c) =>
        `- **${c.framework} ${c.controlId}** (${c.title}): ${c.eventCount} events — rules: ${c.evidenceRules.join(', ')} — samples: ${c.sampleRecordIds.join(', ')}`,
    ),
    ``,
    `## Top attack classes`,
    ...report.topAttackClasses.map((a) => `- ${a.category}: ${a.count}`),
  ];
  return lines.join('\n');
}

export async function generateComplianceReport(opts?: {
  tenantId?: string;
  windowDays?: number;
  useLlm?: boolean;
}): Promise<ComplianceReport> {
  const windowDays = opts?.windowDays ?? 7;
  const catalog = loadComplianceCatalog();
  const records = await loadSemanticAuditRecordsAsync({
    tenantId: opts?.tenantId,
    sinceMs: windowDays * 24 * 60 * 60 * 1000,
    limit: 5000,
  });

  const blockedCount = records.filter((r) => r.syncDecision?.action === 'block').length;
  const semanticFlagCount = records.filter((r) => r.semanticAudit?.suspicious).length;
  const controlMappings = aggregateControls(records, catalog);
  const topAttackClasses_ = topAttackClasses(records);

  let briefing: string | undefined;
  const useLlm = opts?.useLlm ?? process.env.MASTYFF_AI_COMPLIANCE_LLM !== 'false';
  if (useLlm) {
    const llm = new LlmAssistant({ hotPath: false });
    if (llm.isAvailable()) {
      const summary = JSON.stringify({
        windowDays,
        totalEvents: records.length,
        blockedCount,
        semanticFlagCount,
        topAttackClasses: topAttackClasses_,
        controls: controlMappings.slice(0, 8).map((c) => `${c.framework} ${c.controlId}: ${c.eventCount}`),
      });
      const result = await llm.generate(
        'You are a CISO briefing assistant. Write a 4-6 sentence weekly security summary for auditors. Cite control IDs. Be factual.',
        summary,
      );
      briefing = result?.text?.slice(0, 1200);
    }
  }

  if (!briefing) {
    briefing = `Last ${windowDays} days: ${records.length} audited calls, ${blockedCount} blocks, ${semanticFlagCount} semantic flags. Top class: ${topAttackClasses_[0]?.category || 'none'} (${topAttackClasses_[0]?.count || 0}). ${controlMappings.length} control mappings with cited record IDs.`;
  }

  Logger.info(`[ComplianceCopilot] Report: ${records.length} events, ${controlMappings.length} controls`);

  const base: Omit<ComplianceReport, 'exportFormats'> = {
    generatedAt: new Date().toISOString(),
    windowDays,
    totalEvents: records.length,
    blockedCount,
    semanticFlagCount,
    controlMappings,
    topAttackClasses: topAttackClasses_,
    briefing,
  };

  const markdown = formatComplianceMarkdown({ ...base, exportFormats: { markdown: '', json: '' } });
  return {
    ...base,
    exportFormats: {
      markdown,
      json: JSON.stringify(base, null, 2),
    },
  };
}
