import pino from 'pino';

/**
 * Detect if running as an MCP server (stdio transport).
 * In server mode, stdout is reserved for JSON-RPC frames.
 * ALL log output must go to stderr.
 */
export function detectMcpServerMode(): boolean {
  if (process.env['MCP_GUARDIAN_MODE'] === 'server') return true;
  if (process.env['MCP_GUARDIAN_MODE'] === 'cli') return false;
  if (process.env['MCP_GUARDIAN_MODE'] === 'proxy') return true;
  const arg0 = process.argv[1] ?? '';
  const args = process.argv.join(' ');
  if (arg0.endsWith('index.js') || arg0.endsWith('index.ts')) return true;
  if (args.includes(' proxy') || args.endsWith(' proxy')) return true;
  return false;
}

export const IS_MCP_SERVER_MODE = detectMcpServerMode();

export const logger = pino(
  {
    level: process.env['LOG_LEVEL']?.toLowerCase() ?? 'info',
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers["x-api-key"]',
        '*.token', '*.apiKey', '*.password', '*.secret', '*.privateKey',
      ],
      censor: '[REDACTED]',
    },
  },
  pino.destination({ fd: 2, sync: false }),
);

export class Logger {
  static debug(msg: string): void { logger.debug(msg); }
  static info(msg: string): void  { logger.info(msg); }
  static warn(msg: string): void  { logger.warn(msg); }
  static error(msg: string): void { logger.error(msg); }
}

// Backward-compatible LogLevel enum kept for existing consumers
export enum LogLevel { DEBUG = 0, INFO = 1, WARN = 2, ERROR = 3 }