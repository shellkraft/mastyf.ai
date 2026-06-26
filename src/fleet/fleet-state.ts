import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export type FleetServerStatus = 'running' | 'stopped' | 'starting' | 'error';

export interface FleetServerState {
  name: string;
  pid: number;
  port: number;
  transport: 'stdio' | 'sse' | 'streamable' | 'remote-coordinator';
  status: FleetServerStatus;
  localUrl: string;
  configPath?: string;
}

export interface FleetState {
  servers: FleetServerState[];
  startedAt: string;
  adminPort: number;
  workspaceRoot: string;
  policyPath: string;
}

const FLEET_DIR = join(homedir(), '.mastyf-ai');
export const FLEET_STATE_PATH = join(FLEET_DIR, 'fleet-state.json');

export const FLEET_PORT_MIN = 9100;
export const FLEET_PORT_MAX = 9198;
export const FLEET_ADMIN_PORT = 9199;

export function readFleetState(): FleetState | null {
  try {
    if (!existsSync(FLEET_STATE_PATH)) return null;
    return JSON.parse(readFileSync(FLEET_STATE_PATH, 'utf-8')) as FleetState;
  } catch {
    return null;
  }
}

export function writeFleetState(state: FleetState): void {
  mkdirSync(FLEET_DIR, { recursive: true });
  writeFileSync(FLEET_STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf-8');
}

export function clearFleetState(): void {
  if (existsSync(FLEET_STATE_PATH)) {
    writeFileSync(FLEET_STATE_PATH, JSON.stringify({ servers: [], startedAt: '', adminPort: FLEET_ADMIN_PORT, workspaceRoot: '', policyPath: '' }, null, 2));
  }
}

/** Assign stable ports from pool, reusing prior assignments when possible. */
export function allocateFleetPorts(
  serverNames: string[],
  prior?: FleetState | null,
): Map<string, number> {
  const used = new Set<number>();
  const result = new Map<string, number>();

  if (prior) {
    for (const s of prior.servers) {
      if (serverNames.includes(s.name) && s.port >= FLEET_PORT_MIN && s.port <= FLEET_PORT_MAX) {
        result.set(s.name, s.port);
        used.add(s.port);
      }
    }
  }

  let next = FLEET_PORT_MIN;
  for (const name of serverNames) {
    if (result.has(name)) continue;
    while (used.has(next) && next <= FLEET_PORT_MAX) next++;
    if (next > FLEET_PORT_MAX) {
      throw new Error(`Fleet port pool exhausted (${FLEET_PORT_MIN}-${FLEET_PORT_MAX})`);
    }
    result.set(name, next);
    used.add(next);
    next++;
  }
  return result;
}

export function localIngressUrl(port: number, transport: 'streamable' | 'sse' = 'streamable'): string {
  return transport === 'streamable'
    ? `http://127.0.0.1:${port}/mcp`
    : `http://127.0.0.1:${port}/sse`;
}
