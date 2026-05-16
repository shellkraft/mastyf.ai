import { homedir } from 'os';
import { join } from 'path';

const DEFAULT_DB_PATH = join(homedir(), '.mcp-guardian', 'history.db');

/** Canonical SQLite path for all Guardian processes (proxy, TUI, scan, audit). */
export function resolveGuardianDbPath(explicit?: string): string {
  if (explicit === ':memory:') return ':memory:';
  return explicit ?? process.env['MCP_GUARDIAN_DB_PATH'] ?? DEFAULT_DB_PATH;
}

export function getDefaultGuardianDbPath(): string {
  return DEFAULT_DB_PATH;
}
