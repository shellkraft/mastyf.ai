import { HistoryDatabase } from '../database/history-db.js';
import { getAllActiveServerNames, parseSecurityScanDetails } from '../utils/db-aggregate.js';
import { ProxyCallRecord, CostReport, SecurityReport, HealthReport, McpServerConfig } from '../types.js';
import { SecurityScanner } from '../services/security-scanner.js';
import { CostAuditor } from '../services/cost-auditor.js';
import { HealthMonitor } from '../services/health-monitor.js';
import { PricingClient } from '../clients/pricing-client.js';
import { Logger } from '../utils/logger.js';

export interface ServerIndex {
  [serverName: string]: McpServerConfig;
}

export interface GovernanceSnapshot {
  timestamp: string;
  callRecords: ProxyCallRecord[];
  securityReports: SecurityReport[];
  costReports: CostReport[];
  healthReports: HealthReport[];
  servers: ServerIndex;
  metadata: {
    totalCalls: number;
    totalTokens: number;
    estimatedTotalCost: number;
    activeServers: string[];
    pricingModel: string;
    averageLatencyMs: number;
    blockedCalls: number;
    flaggedCalls: number;
  };
}

export interface PolicyDecisionRecord {
  requestId: string | number;
  serverName: string;
  toolName: string;
  action: 'pass' | 'block' | 'flag';
  rule: string;
  reason: string;
  timestamp: string;
  requestTokens: number;
}

let registeredCollector: DataCollector | null = null;

/** Register the live collector (proxy / AI engine) for policy decision ingestion. */
export function registerDataCollector(collector: DataCollector): void {
  registeredCollector = collector;
}

export function recordPolicyDecisionGlobal(d: PolicyDecisionRecord): void {
  registeredCollector?.recordPolicyDecision(d);
}

export class DataCollector {
  private db: HistoryDatabase;
  private securityScanner?: SecurityScanner;
  private costAuditor?: CostAuditor;
  private healthMonitor?: HealthMonitor;
  private pricingClient: PricingClient;
  private policyDecisions: PolicyDecisionRecord[] = [];
  private maxDecisionsStored = 10000;

  constructor(
    db: HistoryDatabase,
    securityScanner?: SecurityScanner,
    costAuditor?: CostAuditor,
    healthMonitor?: HealthMonitor,
    pricingClient?: PricingClient,
  ) {
    this.db = db;
    this.securityScanner = securityScanner;
    this.costAuditor = costAuditor;
    this.healthMonitor = healthMonitor;
    this.pricingClient = pricingClient || new PricingClient();
  }

  async collectCallRecords(serverName?: string): Promise<ProxyCallRecord[]> {
    try {
      if (serverName) return await this.db.getCallRecordsForServer(serverName);
      const servers = await getAllActiveServerNames(this.db);
      if (servers.length === 0) return [];
      const all: ProxyCallRecord[] = [];
      for (const srv of servers) {
        all.push(...await this.db.getCallRecordsForServer(srv));
      }
      return all;
    } catch (err: any) {
      Logger.warn(`[DataCollector] callRecords failed: ${err?.message}`);
      return [];
    }
  }

  recordPolicyDecision(d: PolicyDecisionRecord): void {
    this.policyDecisions.push(d);
    if (this.policyDecisions.length > this.maxDecisionsStored) {
      this.policyDecisions = this.policyDecisions.slice(-this.maxDecisionsStored);
    }
  }

  getPolicyDecisions(): PolicyDecisionRecord[] {
    return [...this.policyDecisions];
  }

  async collectSecurityReports(servers: McpServerConfig[]): Promise<SecurityReport[]> {
    if (this.securityScanner) {
      try {
        return await Promise.all(servers.map(s => this.securityScanner!.scanServer(s)));
      } catch (err: any) {
        Logger.warn(`[DataCollector] securityReports failed: ${err?.message}`);
        return [];
      }
    }
    return this.collectSecurityReportsFromDb(servers);
  }

  private async collectSecurityReportsFromDb(servers: McpServerConfig[]): Promise<SecurityReport[]> {
    const reports: SecurityReport[] = [];
    for (const s of servers) {
      const scan = await this.db.getLatestSecurityScan(s.name);
      if (!scan) continue;
      const parsed = parseSecurityScanDetails(scan as unknown as Record<string, unknown>);
      if (parsed) reports.push(parsed);
    }
    return reports;
  }

  async collectCostReports(servers: McpServerConfig[]): Promise<CostReport[]> {
    if (!this.costAuditor) return [];
    try {
      return await Promise.all(servers.map(s => this.costAuditor!.auditServer(s)));
    } catch (err: any) {
      Logger.warn(`[DataCollector] costReports failed: ${err?.message}`);
      return [];
    }
  }

  async collectHealthReports(servers: McpServerConfig[]): Promise<HealthReport[]> {
    if (this.healthMonitor) {
      try {
        return await Promise.all(servers.map(s => this.healthMonitor!.checkServer(s)));
      } catch (err: any) {
        Logger.warn(`[DataCollector] healthReports failed: ${err?.message}`);
        return [];
      }
    }
    return this.collectHealthReportsFromDb(servers);
  }

  private async collectHealthReportsFromDb(servers: McpServerConfig[]): Promise<HealthReport[]> {
    const reports: HealthReport[] = [];
    for (const s of servers) {
      const hc = await this.db.getLatestHealthCheck(s.name);
      if (!hc) continue;
      const toolCount = hc.tool_count ?? 0;
      reports.push({
        serverName: s.name,
        latencyMs: hc.latency_ms,
        successRate: hc.success ? 1 : 0,
        contextPressure: Math.min(toolCount / 20, 1),
        toolCount,
        overloadWarning: toolCount > 15,
        recommendations: toolCount > 15 ? ['Tool overload detected'] : [],
      });
    }
    return reports;
  }

  async collectAll(servers: McpServerConfig[]): Promise<GovernanceSnapshot> {
    const [callRecords, securityReports, costReports, healthReports] = await Promise.all([
      this.collectCallRecords(),
      this.collectSecurityReports(servers),
      this.collectCostReports(servers),
      this.collectHealthReports(servers),
    ]);

    const decisions = this.getPolicyDecisions();
    const activeServers = [...new Set(servers.map(s => s.name))];
    const totalCalls = callRecords.length;
    const totalTokens = callRecords.reduce((s, r) => s + r.totalTokens, 0);
    const estimatedTotalCost = costReports.reduce((s, r) => s + (r.actualCostUSD ?? r.estimatedCostUSD), 0);
    const totalLatency = callRecords.reduce((s, r) => s + r.durationMs, 0);
    const avgLatency = totalCalls > 0 ? Math.round(totalLatency / totalCalls) : 0;
    const blockedFromRecords = callRecords.filter((r) => r.blocked).length;
    const blockedFromDecisions = decisions.filter((d) => d.action === 'block').length;
    const blocked = Math.max(blockedFromRecords, blockedFromDecisions);
    const flagged = decisions.filter((d) => d.action === 'flag').length;

    const serverIndex: ServerIndex = {};
    for (const s of servers) serverIndex[s.name] = s;

    return {
      timestamp: new Date().toISOString(),
      callRecords,
      securityReports,
      costReports,
      healthReports,
      servers: serverIndex,
      metadata: {
        totalCalls, totalTokens, estimatedTotalCost, activeServers,
        pricingModel: this.costAuditor ? await this.costAuditor.getPricingModel() : 'unknown',
        averageLatencyMs: avgLatency,
        blockedCalls: blocked,
        flaggedCalls: flagged,
      },
    };
  }
}