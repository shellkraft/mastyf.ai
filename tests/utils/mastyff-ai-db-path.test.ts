import { describe, it, expect, afterEach } from 'vitest';
import {
  resolveMastyffAiDbPath,
  getDefaultMastyffAiDbPath,
  resolveMcpServerDbPath,
} from '../../src/utils/mastyff-ai-db-path.js';
import { homedir } from 'os';
import { join } from 'path';

describe('resolveMastyffAiDbPath', () => {
  const prev = process.env.MASTYFF_AI_DB_PATH;

  afterEach(() => {
    if (prev === undefined) delete process.env.MASTYFF_AI_DB_PATH;
    else process.env.MASTYFF_AI_DB_PATH = prev;
  });

  it('uses explicit path when provided', () => {
    expect(resolveMastyffAiDbPath('/tmp/custom.db')).toBe('/tmp/custom.db');
  });

  it('uses MASTYFF_AI_DB_PATH env when set', () => {
    process.env.MASTYFF_AI_DB_PATH = '/tmp/env.db';
    expect(resolveMastyffAiDbPath()).toBe('/tmp/env.db');
  });

  it('defaults to ~/.mastyff-ai/history.db', () => {
    delete process.env.MASTYFF_AI_DB_PATH;
    expect(resolveMastyffAiDbPath()).toBe(getDefaultMastyffAiDbPath());
  });

  it('resolveMcpServerDbPath uses separate mcp-server.db under home', () => {
    delete process.env.MASTYFF_AI_DB_PATH;
    expect(resolveMcpServerDbPath()).toBe(join(homedir(), '.mastyff-ai', 'mcp-server.db'));
  });
});
