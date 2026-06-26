import { describe, it, expect, vi, afterEach } from 'vitest';
import { McpProxyServer } from '../../src/proxy/proxy-server.js';
import { HistoryDatabase } from '../../src/database/history-db.js';

describe('McpProxyServer child death cleanup', () => {
  let proxy: McpProxyServer | null = null;
  let db: HistoryDatabase | null = null;
  const lines: string[] = [];

  afterEach(() => {
    proxy?.kill();
    proxy = null;
    db?.close();
    db = null;
    lines.length = 0;
    vi.restoreAllMocks();
  });

  it('fails pending request contexts when child exits', async () => {
    db = new HistoryDatabase(':memory:');
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      lines.push(String(chunk));
      return true;
    });

    proxy = new McpProxyServer(
      'node',
      ['-e', 'process.exit(1)'],
      { PATH: process.env.PATH || '' },
      db,
      'child-death-test',
      undefined,
      undefined,
      60_000,
      0,
    );

    (proxy as any).requestContexts.set('req-1', {
      requestStartTime: Date.now(),
      createdAt: Date.now(),
      requestToolName: 'echo',
      requestTokens: 1,
      requestRaw: '{}',
    });
    (proxy as any).requestContexts.set('req-2', {
      requestStartTime: Date.now(),
      createdAt: Date.now(),
      requestToolName: 'echo',
      requestTokens: 1,
      requestRaw: '{}',
    });

    await new Promise((r) => setTimeout(r, 500));

    expect((proxy as any).requestContexts.size).toBe(0);
    const payloads = lines
      .join('')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    const errors = payloads.filter((p) => p.error && (p.id === 'req-1' || p.id === 'req-2'));
    expect(errors.length).toBeGreaterThanOrEqual(2);

    stdoutSpy.mockRestore();
  });
});
