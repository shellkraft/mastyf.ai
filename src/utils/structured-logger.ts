import pino from 'pino';
import { PolicyDecision, CallContext } from '../policy/policy-types.js';

/**
 * Structured JSON logger for enterprise SIEM ingestion.
 * Always writes to stderr — stdout is reserved for MCP JSON-RPC in proxy mode.
 */
const level = process.env.LOG_LEVEL || 'info';

const logger = pino(
  {
    level: level.toLowerCase(),
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  pino.destination({ fd: 2, sync: false }),
);

export interface AuditLogEntry {
  event: 'policy_decision';
  requestId: string | number;
  serverName: string;
  toolName: string;
  decision: PolicyDecision;
  context: CallContext;
}

export interface BlockLogEntry {
  event: 'tool_blocked';
  requestId: string | number;
  serverName: string;
  toolName: string;
  reason: string;
  rule: string;
}

export interface ErrorLogEntry {
  event: 'proxy_error' | 'oidc_discovery_error' | 'oidc_auth_error';
  requestId?: string | number;
  serverName: string;
  error: string;
  stack?: string;
}

export class StructuredLogger {
  static logPolicyDecision(entry: AuditLogEntry): void {
    logger.info(entry);
    import('./enterprise-bootstrap.js').then(({ exportSiemEvent }) => {
      exportSiemEvent('policy_decision', entry as unknown as Record<string, unknown>).catch(() => {});
    }).catch(() => {});
  }

  static logBlocked(entry: BlockLogEntry): void {
    logger.warn(entry);
    import('./enterprise-bootstrap.js').then(({ exportSiemEvent }) => {
      exportSiemEvent('tool_blocked', entry as unknown as Record<string, unknown>).catch(() => {});
    }).catch(() => {});
  }

  static logError(entry: ErrorLogEntry): void {
    logger.error(entry);
  }

  static info(msg: object | string): void {
    logger.info(msg);
  }

  static debug(msg: object | string): void {
    logger.debug(msg);
  }
}
