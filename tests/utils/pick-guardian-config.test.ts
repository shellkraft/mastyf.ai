import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pickGuardianConfig } from '../../src/utils/pick-guardian-config.js';

describe('pickGuardianConfig', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'guardian-pick-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('picks single stdio server config', () => {
    const configs = join(dir, 'guardian-configs');
    mkdirSync(configs, { recursive: true });
    writeFileSync(
      join(configs, 'one.json'),
      JSON.stringify({
        mcpServers: { fs: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'] } },
      }),
    );
    const hit = pickGuardianConfig({ searchRoots: [dir] });
    expect(hit).toContain('one.json');
  });

  it('skips multi-server configs', () => {
    const configs = join(dir, 'guardian-configs');
    mkdirSync(configs, { recursive: true });
    writeFileSync(
      join(configs, 'multi.json'),
      JSON.stringify({
        mcpServers: {
          a: { command: 'echo' },
          b: { command: 'echo' },
        },
      }),
    );
    expect(pickGuardianConfig({ searchRoots: [dir] })).toBeNull();
  });
});
