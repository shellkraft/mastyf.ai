/**
 * Build ScoreInput + certification from security scan and proxy history.
 */
import type { McpServerConfig, SecurityReport } from '../../types.js';
import type { ScoreInput } from '../trust-score/mastyf-ai-score.js';
import type { AuthStatus } from '../../types.js';
import { MCPCertifier, type CertificationResult } from './certifier.js';
import { MastyfAiScore } from '../trust-score/mastyf-ai-score.js';
import {
  buildPublishableScoreReport,
  issuesFromSecurityScan,
  scoreReportCheckPayload,
} from '../trust-score/score-report.js';
import { IndustryStandardStore } from '../../database/industry-standard-store.js';
import { createDatabase } from '../../database/create-database.js';
import { resolveMastyfAiDbPath } from '../../utils/mastyf-ai-db-path.js';
import { getAllActiveServerNames, loadAllCallRecords, summarizeRecords } from '../../utils/db-aggregate.js';
import { SecurityScanner } from '../../services/security-scanner.js';
import { HealthMonitor } from '../../services/health-monitor.js';
import { resolveTenantId } from '../../tenant/resolve-tenant.js';
import { renderTrustBadgeSvg, buildBadgeEmbedMarkdown } from '../trust-score/trust-badge-svg.js';

const HIGH_RISK = /exec|shell|delete|deploy|admin|run|bash|execute|terminal|sudo|kill/i;
const MEDIUM_RISK = /write|update|create|send|post|put|patch|upload|modify/i;

export function classifyToolRisk(toolNames: string[]): {
  highRiskToolCount: number;
  mediumRiskToolCount: number;
  totalToolCount: number;
} {
  let high = 0;
  let medium = 0;
  for (const name of toolNames) {
    if (HIGH_RISK.test(name)) high++;
    else if (MEDIUM_RISK.test(name)) medium++;
  }
  return { highRiskToolCount: high, mediumRiskToolCount: medium, totalToolCount: toolNames.length };
}

function mapAuthMethod(auth: AuthStatus): ScoreInput['authMethod'] {
  const method = (auth.method || '').toLowerCase();
  if (method.includes('mtls') || method.includes('m_tls')) return 'oauth2_mtls';
  if (method.includes('oauth')) return 'oauth2';
  if (method.includes('api') || method.includes('key') || method.includes('bearer')) return 'api_key';
  return auth.hasAuthentication ? 'api_key' : 'none';
}

function mapTransport(
  server: McpServerConfig,
  auth: AuthStatus,
): ScoreInput['transport'] {
  if (auth.hasAuthentication && server.transport === 'websocket') return 'mTLS';
  if (server.transport === 'stdio') return 'stdio';
  const url = (server.url || '').toLowerCase();
  if (url.startsWith('https') || auth.isTransportEncrypted) return 'https';
  if (server.transport === 'sse' || url.startsWith('http')) return 'http';
  return 'stdio';
}

function cvssFromSeverity(severity: string): number {
  switch (severity) {
    case 'CRITICAL': return 9.5;
    case 'HIGH': return 7.5;
    case 'MEDIUM': return 5.0;
    case 'LOW': return 2.0;
    default: return 0;
  }
}

export function buildScoreInputFromScan(opts: {
  server: McpServerConfig;
  report: SecurityReport;
  toolNames?: string[];
  blockedCalls?: number;
  bypassedAttacks?: number;
}): ScoreInput {
  const tools = opts.toolNames ?? [];
  const risk = classifyToolRisk(tools);
  const maxCvss = opts.report.cves.reduce(
    (m, c) => Math.max(m, cvssFromSeverity(c.severity)),
    0,
  );

  return {
    serverName: opts.server.name,
    cveCount: opts.report.cves.length,
    maxCvss,
    newestCveAgeDays: 0,
    authMethod: mapAuthMethod(opts.report.authStatus),
    transport: mapTransport(opts.server, opts.report.authStatus),
    highRiskToolCount: risk.highRiskToolCount,
    mediumRiskToolCount: risk.mediumRiskToolCount,
    totalToolCount: risk.totalToolCount,
    trustedPublisher: !opts.report.typoSquatRisk.length,
    typoSquatDetected: opts.report.typoSquatRisk.length > 0,
    depConfusionDetected: false,
    blockedCalls: opts.blockedCalls ?? 0,
    bypassedAttacks: opts.bypassedAttacks ?? 0,
    responseDlpActive: true,
    mastyfAiProtected: true,
  };
}

export async function scanServerForCertification(
  server: McpServerConfig,
  dbPath?: string,
): Promise<{ report: SecurityReport; toolNames: string[]; blockedCalls: number }> {
  const scanner = new SecurityScanner();
  const report = await scanner.scanServer(server);
  const tenantId = resolveTenantId();
  const db = await createDatabase(dbPath ?? resolveMastyfAiDbPath());
  await db.initialize();
  try {
    const health = new HealthMonitor(db, tenantId);
    const check = await health.checkServer(server, tenantId);
    const names = await getAllActiveServerNames(db, tenantId);
    const records = (await loadAllCallRecords(db, names, tenantId)).filter(
      (r) => r.serverName === server.name,
    );
    const summary = summarizeRecords(records);
    const toolNames = [...new Set(records.map((r) => r.toolName).filter(Boolean))];
    if (check.toolCount > toolNames.length) {
      /* health may see more tools than history */
    }
    return {
      report,
      toolNames,
      blockedCalls: summary.blocked,
    };
  } finally {
    await db.close();
  }
}

export type CertifyPublishResult = {
  certification: CertificationResult;
  cloudId?: string;
  badgeMarkdown: string;
  verifyUrl: string;
};

export async function runCertifyPublish(opts: {
  serverName: string;
  packageName: string;
  version: string;
  cloudUrl: string;
  apiKey?: string;
  dbPath?: string;
  server?: McpServerConfig;
}): Promise<CertifyPublishResult> {
  const server: McpServerConfig = opts.server ?? {
    name: opts.serverName,
    transport: 'stdio',
    packageName: opts.packageName,
    version: opts.version,
  };

  const { report, toolNames, blockedCalls } = await scanServerForCertification(server, opts.dbPath);
  const scoreInput = buildScoreInputFromScan({ server, report, toolNames, blockedCalls });

  const db = await createDatabase(opts.dbPath ?? resolveMastyfAiDbPath());
  await db.initialize();
  let certification: CertificationResult;
  try {
    const store = new IndustryStandardStore(db);
    const certifier = new MCPCertifier(store);
    certification = certifier.certifyFromScan(
      opts.serverName,
      opts.packageName,
      opts.version,
      scoreInput,
    );
  } finally {
    await db.close();
  }

  const cloudBase = opts.cloudUrl.replace(/\/$/, '');
  const trustScore = new MastyfAiScore().compute(scoreInput);
  const scoreReport = buildPublishableScoreReport(
    trustScore,
    issuesFromSecurityScan(report, toolNames, scoreInput),
  );
  const body = {
    serverName: certification.serverName,
    packageName: opts.packageName,
    version: opts.version,
    level: certification.level,
    score: certification.score,
    attestationJws: certification.signedAttestation,
    checks: [...certification.checks, scoreReportCheckPayload(scoreReport)],
    issuedAt: certification.issuedAt,
    expiresAt: certification.expiresAt,
  };

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`;

  const res = await fetch(`${cloudBase}/api/v1/certifications`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Cloud publish failed (${res.status}): ${errText}`);
  }

  const cloud = (await res.json()) as { id?: string };
  const verifyUrl = `${cloudBase}/certified/${encodeURIComponent(opts.packageName)}`;
  const badgeMarkdown = buildBadgeEmbedMarkdown({
    cloudBaseUrl: cloudBase,
    packageName: opts.packageName,
    style: 'github',
  });

  return {
    certification,
    cloudId: cloud.id,
    badgeMarkdown,
    verifyUrl,
  };
}

export function previewBadgeSvg(score: number, packageName: string): string {
  return renderTrustBadgeSvg({ score, packageName });
}
