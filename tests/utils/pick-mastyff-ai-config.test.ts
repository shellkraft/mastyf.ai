import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pickMastyffAiConfig } from '../../src/utils/pick-mastyff-ai-config.js';

describe('pickMastyffAiConfig', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mastyff-ai-pick-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('picks single stdio server config', () => {
    const configs = join(dir, 'mastyff-ai-configs');
    mkdirSync(configs, { recursive: true });
    writeFileSync(
      join(configs, 'one.json'),
      JSON.stringify({
        mcpServers: { fs: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'] } },
      }),
    );
    const hit = pickMastyffAiConfig({ searchRoots: [dir] });
    expect(hit).toContain('one.json');
  });

  it('skips multi-server configs', () => {
    const configs = join(dir, 'mastyff-ai-configs');
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
    expect(pickMastyffAiConfig({ searchRoots: [dir] })).toBeNull();
  });
});
