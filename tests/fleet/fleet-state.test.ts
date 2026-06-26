import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { allocateFleetPorts, localIngressUrl } from '../../src/fleet/fleet-state.js';

describe('fleet-state', () => {
  it('allocates stable ports from pool', () => {
    const ports = allocateFleetPorts(['a', 'b', 'c']);
    expect(ports.get('a')).toBe(9100);
    expect(ports.get('b')).toBe(9101);
    expect(ports.get('c')).toBe(9102);
  });

  it('reuses prior port assignments', () => {
    const prior = {
      servers: [
        { name: 'a', pid: 1, port: 9105, transport: 'stdio' as const, status: 'running' as const, localUrl: '' },
      ],
      startedAt: '',
      adminPort: 9199,
      workspaceRoot: '',
      policyPath: '',
    };
    const ports = allocateFleetPorts(['a', 'b'], prior);
    expect(ports.get('a')).toBe(9105);
    expect(ports.get('b')).toBe(9100);
  });

  it('builds streamable local ingress URL', () => {
    expect(localIngressUrl(9100, 'streamable')).toBe('http://127.0.0.1:9100/mcp');
    expect(localIngressUrl(9100, 'sse')).toBe('http://127.0.0.1:9100/sse');
  });
});
