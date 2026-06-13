import { homedir } from 'os';
import { join } from 'path';

const DEFAULT_DB_PATH = join(homedir(), '.mastyff-ai', 'history.db');
const MCP_SERVER_DB_PATH = join(homedir(), '.mastyff-ai', 'mcp-server.db');

/** Canonical SQLite path for all Mastyff AI processes (proxy, TUI, scan, audit). */
export function resolveMastyffAiDbPath(explicit?: string): string {
  if (explicit === ':memory:') return ':memory:';
  return explicit ?? process.env['MASTYFF_AI_DB_PATH'] ?? DEFAULT_DB_PATH;
}

export function getDefaultMastyffAiDbPath(): string {
  return DEFAULT_DB_PATH;
}

/**
 * MCP stdio server DB (Cline cannot pass env) — separate file from proxy history to avoid locks.
 */
export function resolveMcpServerDbPath(): string {
  return process.env['MASTYFF_AI_DB_PATH'] ?? MCP_SERVER_DB_PATH;
}
