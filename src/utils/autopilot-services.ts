/**
 * Start Autopilot background services (scheduler, reports).
 */
import { DEFAULT_TENANT_ID } from '../tenant/resolve-tenant.js';
import { applyAutopilotEnv, isAutopilotMode } from './autopilot-profile.js';
import { maybeAutoStart } from './threat-discovery-scheduler.js';
import { startReportScheduler } from './report-scheduler.js';
import { readAutopilotConfig } from './autopilot-config.js';
import { startHealthProbeScheduler } from '../services/health-probe-scheduler.js';

export function startAutopilotServices(
  historyDb: unknown,
  tenantId: string = DEFAULT_TENANT_ID,
): void {
  applyAutopilotEnv();
  const cfg = readAutopilotConfig();
  const autopilot =
    isAutopilotMode()
    || process.env.GUARDIAN_THREAT_DISCOVERY_AUTOSTART === 'true'
    || cfg?.enabled;

  if (autopilot) {
    maybeAutoStart(tenantId);
  }

  const schedule = process.env.GUARDIAN_REPORT_SCHEDULE || cfg?.reportSchedule;
  if (schedule && schedule !== 'off') {
    startReportScheduler(historyDb, tenantId);
  }

  startHealthProbeScheduler();
}
