import { describe, it, expect, afterEach } from 'vitest';
import { resolveGuardianDbPath, getDefaultGuardianDbPath } from '../../src/utils/guardian-db-path.js';

describe('resolveGuardianDbPath', () => {
  const prev = process.env.MCP_GUARDIAN_DB_PATH;

  afterEach(() => {
    if (prev === undefined) delete process.env.MCP_GUARDIAN_DB_PATH;
    else process.env.MCP_GUARDIAN_DB_PATH = prev;
  });

  it('uses explicit path when provided', () => {
    expect(resolveGuardianDbPath('/tmp/custom.db')).toBe('/tmp/custom.db');
  });

  it('uses MCP_GUARDIAN_DB_PATH env when set', () => {
    process.env.MCP_GUARDIAN_DB_PATH = '/tmp/env.db';
    expect(resolveGuardianDbPath()).toBe('/tmp/env.db');
  });

  it('defaults to ~/.mcp-guardian/history.db', () => {
    delete process.env.MCP_GUARDIAN_DB_PATH;
    expect(resolveGuardianDbPath()).toBe(getDefaultGuardianDbPath());
  });
});
