/**
 * Optional periodic health probes for configured MCP servers.
 */
import type { IDatabase } from '../database/database-interface.js';
import type { McpServerConfig } from '../types.js';
import { HealthMonitor } from './health-monitor.js';
import { Logger } from '../utils/logger.js';

let timer: ReturnType<typeof setInterval> | null = null;

export function startHealthProbeScheduler(
  db: IDatabase,
  servers: McpServerConfig[],
  tenantId?: string,
): void {
  const intervalMs = parseInt(process.env['GUARDIAN_HEALTH_PROBE_INTERVAL_MS'] || '0', 10);
  if (!Number.isFinite(intervalMs) || intervalMs <= 0 || servers.length === 0) return;
  if (timer) return;

  const monitor = new HealthMonitor(db, tenantId);
  const run = () => {
    for (const server of servers) {
      void monitor.checkServer(server, tenantId).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        Logger.debug(`[health-probe] ${server.name}: ${msg}`);
      });
    }
  };

  timer = setInterval(run, intervalMs);
  timer.unref?.();
  Logger.info(`[health-probe] Scheduled every ${intervalMs}ms for ${servers.length} server(s)`);
}

export function stopHealthProbeScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
