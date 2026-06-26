import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('unified-server-registry', () => {
  const workspace = join(tmpdir(), `mastyf-fleet-${Date.now()}`);
  const configsDir = join(workspace, 'mastyf-ai-configs');
  const serversPath = join(workspace, 'servers.json');

  beforeEach(() => {
    mkdirSync(configsDir, { recursive: true });
    process.env.MASTYF_AI_SERVERS_JSON_PATH = serversPath;
  });

  afterEach(() => {
    delete process.env.MASTYF_AI_SERVERS_JSON_PATH;
    rmSync(workspace, { recursive: true, force: true });
  });

  it('merges UI over wrapped configs by name', async () => {
    writeFileSync(
      join(configsDir, 'echo.json'),
      JSON.stringify({
        mcpServers: {
          echo: { command: 'node', args: ['echo.js'], transport: 'stdio' },
        },
      }),
    );
    writeFileSync(
      serversPath,
      JSON.stringify([
        {
          name: 'echo',
          command: 'node',
          args: ['ui-override.js'],
          transport: 'stdio',
          disabled: false,
        },
      ]),
    );

    const { discoverAllServers } = await import('../../src/fleet/unified-server-registry.js');
    const entries = discoverAllServers({ workspaceRoot: workspace, includeIde: false });
    const echo = entries.find((e) => e.name === 'echo');
    expect(echo?.source).toBe('ui');
    expect(echo?.config.command).toBe('node');
    expect(echo?.config.args).toEqual(['ui-override.js']);
  });

  it('materializeServerConfig writes single-server JSON', async () => {
    const { discoverAllServers, materializeServerConfig } = await import(
      '../../src/fleet/unified-server-registry.js'
    );
    writeFileSync(
      serversPath,
      JSON.stringify([
        {
          name: 'demo',
          command: 'node',
          args: ['srv.js'],
          transport: 'stdio',
          disabled: false,
        },
      ]),
    );
    const entry = discoverAllServers({ workspaceRoot: workspace, includeIde: false })[0]!;
    const path = materializeServerConfig(entry, workspace);
    expect(path).toContain('demo.json');
    const raw = JSON.parse(readFileSync(path, 'utf-8'));
    expect(raw.mcpServers.demo.command).toBe('node');
  });
});
