import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { tmpdir } from 'os';

describe('patchClientToLocalUrls', () => {
  const clientPath = join(tmpdir(), `mcp-patch-${Date.now()}.json`);
  let backup: string | null = null;

  beforeEach(() => {
    writeFileSync(
      clientPath,
      JSON.stringify({
        mcpServers: {
          alpha: { command: 'node', args: ['alpha.js'] },
          beta: { command: 'node', args: ['beta.js'] },
          'mastyf-ai': { command: 'node', args: ['dist/cli.js'] },
        },
      }, null, 2),
    );
  });

  afterEach(() => {
    rmSync(clientPath, { force: true });
    if (backup && existsSync(backup)) rmSync(backup, { force: true });
  });

  it('replaces server entries with local URLs', async () => {
    const { patchClientToLocalUrls } = await import('../../src/wrap/client-wrap.js');
    const result = patchClientToLocalUrls({
      client: 'auto',
      configPath: clientPath,
      entries: [
        { name: 'alpha', localUrl: 'http://127.0.0.1:9100/mcp' },
        { name: 'beta', localUrl: 'http://127.0.0.1:9101/mcp' },
      ],
      apply: true,
    });
    expect(result.patched).toEqual(['alpha', 'beta']);
    const raw = JSON.parse(readFileSync(clientPath, 'utf-8'));
    expect(raw.mcpServers.alpha.url).toBe('http://127.0.0.1:9100/mcp');
    expect(raw.mcpServers.beta.url).toBe('http://127.0.0.1:9101/mcp');
    expect(raw.mcpServers['mastyf-ai'].command).toBe('node');
    backup = result.backupPath ?? null;
  });
});
