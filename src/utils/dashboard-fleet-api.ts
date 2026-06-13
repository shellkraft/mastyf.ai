/**
 * Dashboard fleet API — maps getFleetStatus() to /api/instances response.
 */
import { getFleetStatus } from '../fleet/fleet-aggregator.js';
import type { IDatabase } from '../database/database-interface.js';
import { getMastyffAiRegion } from './region.js';
import {
  getAllActiveServerNames,
  loadAllCallRecords,
  summarizeRecords,
} from './db-aggregate.js';

/**
 * True when fleet aggregation should read env-configured replicas (not the runtime local DB).
 * NOTE: MASTYFF_AI_DB_PATH is the single-instance local DB path and is intentionally excluded —
 * it does not indicate a fleet/replica setup.
 */
function isExplicitFleetConfig(): boolean {
  if (process.env['DB_TYPE']?.toLowerCase() === 'postgres' && process.env['DATABASE_URL']) {
    return true;
  }
  if (process.env['MASTYFF_AI_FLEET_DB_PATHS']?.trim()) return true;
  return false;
}

export type DashboardFleetInstance = {
  instanceId: string;
  instanceName: string;
  hostname: string;
  status: string;
  region?: string;
  lastHeartbeat: string;
  totalRequests: number;
  blockedRequests: number;
  totalCostUsd: number;
  avgLatencyMs?: number;
  fleetSource: string;
  dbPath?: string;
};

export type DashboardFleetResponse = {
  available: boolean;
  source: string;
  region: string;
  totalInstances: number;
  activeInstances: number;
  totalRequests: number;
  totalBlocked: number;
  totalCostUsd: number;
  instances: DashboardFleetInstance[];
};

function mapFleetRow(
  row: Awaited<ReturnType<typeof getFleetStatus>>['instances'][number],
  source: string,
): DashboardFleetInstance {
  return {
    instanceId: row.instanceId,
    instanceName: row.instanceName,
    hostname: row.hostname,
    status: row.status,
    region: row.region,
    lastHeartbeat: row.lastHeartbeat,
    totalRequests: row.totalRequests,
    blockedRequests: row.blockedRequests,
    totalCostUsd: row.totalCostUsd,
    fleetSource: source,
    dbPath: row.dbPath,
  };
}

async function buildLocalFallbackInstance(
  db: IDatabase | null,
  tenantId: string | undefined,
): Promise<DashboardFleetInstance | null> {
  if (!db) return null;
  const srvs = await getAllActiveServerNames(db, tenantId);
  const records = await loadAllCallRecords(db, srvs, tenantId);
  const sum = summarizeRecords(records);
  const avgLatency = sum.total > 0 ? Math.round(sum.totalLatency / sum.total) : 0;
  return {
    instanceId: process.env['MASTYFF_AI_INSTANCE_ID'] || `mastyff-ai-${process.pid}`,
    instanceName: process.env['MASTYFF_AI_INSTANCE_NAME'] || process.env['HOSTNAME'] || 'localhost',
    hostname: process.env['HOSTNAME'] || 'unknown',
    status: 'active',
    lastHeartbeat: new Date().toISOString(),
    totalRequests: sum.total,
    blockedRequests: sum.blocked,
    totalCostUsd: sum.costUsd,
    avgLatencyMs: avgLatency,
    fleetSource: 'local',
  };
}

export async function buildDashboardFleetResponse(
  db: IDatabase | null,
  tenantId: string | undefined,
): Promise<DashboardFleetResponse> {
  if (!isExplicitFleetConfig()) {
    const local = await buildLocalFallbackInstance(db, tenantId);
    return {
      available: !!local,
      source: local ? 'local' : 'none',
      region: getMastyffAiRegion(),
      totalInstances: local ? 1 : 0,
      activeInstances: local ? 1 : 0,
      totalRequests: local?.totalRequests ?? 0,
      totalBlocked: local?.blockedRequests ?? 0,
      totalCostUsd: local?.totalCostUsd ?? 0,
      instances: local ? [local] : [],
    };
  }

  const report = await getFleetStatus();

  if (report.instances.length > 0) {
    return {
      available: true,
      source: report.source,
      region: report.region,
      totalInstances: report.totalInstances,
      activeInstances: report.activeInstances,
      totalRequests: report.totalRequests,
      totalBlocked: report.totalBlocked,
      totalCostUsd: report.totalCostUsd,
      instances: report.instances.map((row) => mapFleetRow(row, report.source)),
    };
  }

  const local = await buildLocalFallbackInstance(db, tenantId);
  return {
    available: !!local,
    source: local ? 'local' : 'none',
    region: report.region,
    totalInstances: local ? 1 : 0,
    activeInstances: local ? 1 : 0,
    totalRequests: local?.totalRequests ?? 0,
    totalBlocked: local?.blockedRequests ?? 0,
    totalCostUsd: local?.totalCostUsd ?? 0,
    instances: local ? [local] : [],
  };
}
