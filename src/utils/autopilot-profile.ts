/**
 * Mastyff AI Autopilot — single env preset for plug-and-play operation.
 */
import { readAutopilotConfig, type AutopilotConfig } from './autopilot-config.js';

const AUTOPILOT_ENV: Record<string, string> = {
  MASTYFF_AI_AUTOPILOT: 'true',
  DASHBOARD_ENABLED: 'true',
  MASTYFF_AI_WS_ENABLED: 'true',
  MASTYFF_AI_THREAT_RESEARCH_AUTO: 'true',
  SWARM_THREAT_RESEARCH_AUTO: 'true',
  MASTYFF_AI_THREAT_DISCOVERY_AUTOSTART: 'true',
  MASTYFF_AI_AI_ENABLED: 'true',
  MASTYFF_AI_SEMANTIC_ASYNC: 'true',
  MASTYFF_AI_AI_AUTO_APPLY: 'false',
  MASTYFF_AI_AUTO_CORPUS_PROMOTE: 'false',
  MASTYFF_AI_DASHBOARD_STRICT_LIVE: 'true',
  MASTYFF_AI_REPORT_SCHEDULE: 'daily',
};

export function isAutopilotMode(): boolean {
  return process.env.MASTYFF_AI_AUTOPILOT === 'true' || readAutopilotConfig()?.enabled === true;
}

/** Apply Autopilot env defaults (does not override explicitly set vars). */
export function applyAutopilotEnv(config?: AutopilotConfig | null): void {
  const cfg = config ?? readAutopilotConfig();
  const schedule = cfg?.reportSchedule ?? 'daily';
  const hour = cfg?.reportCronHour ?? 6;

  for (const [key, value] of Object.entries(AUTOPILOT_ENV)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  if (process.env.MASTYFF_AI_REPORT_SCHEDULE === undefined) {
    process.env.MASTYFF_AI_REPORT_SCHEDULE = schedule === 'off' ? 'off' : schedule;
  }
  if (process.env.MASTYFF_AI_REPORT_CRON_HOUR === undefined) {
    process.env.MASTYFF_AI_REPORT_CRON_HOUR = String(hour);
  }
  if (cfg?.policyPath && process.env.MASTYFF_AI_POLICY_PATH === undefined) {
    process.env.MASTYFF_AI_POLICY_PATH = cfg.policyPath;
  }
  if (cfg?.corpusEvalGate && process.env.MASTYFF_AI_AUTOPILOT_CORPUS_GATE === undefined) {
    process.env.MASTYFF_AI_AUTOPILOT_CORPUS_GATE = 'true';
  }
}

/** Force Autopilot env (used by `autopilot start`). */
export function forceAutopilotEnv(config?: AutopilotConfig | null): void {
  const cfg = config ?? readAutopilotConfig();
  for (const [key, value] of Object.entries(AUTOPILOT_ENV)) {
    process.env[key] = value;
  }
  process.env.MASTYFF_AI_REPORT_SCHEDULE = cfg?.reportSchedule === 'off' ? 'off' : (cfg?.reportSchedule || 'daily');
  process.env.MASTYFF_AI_REPORT_CRON_HOUR = String(cfg?.reportCronHour ?? 6);
  if (cfg?.policyPath) process.env.MASTYFF_AI_POLICY_PATH = cfg.policyPath;
  if (cfg?.corpusEvalGate !== false) process.env.MASTYFF_AI_AUTOPILOT_CORPUS_GATE = 'true';
  process.env.MASTYFF_AI_AUTOPILOT = 'true';
}
