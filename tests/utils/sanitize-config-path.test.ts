import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { sanitizeConfigPath } from '../../src/utils/sanitize-config-path.js';

describe('sanitizeConfigPath', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mastyff-ai-sanitize-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rejects path traversal', () => {
    expect(sanitizeConfigPath('/tmp/../etc/passwd')).toBeNull();
  });

  it('allows files under cwd (project workspace)', () => {
    const dir = path.join(process.cwd(), 'tests', 'utils', '__sanitize_workspace__');
    fs.mkdirSync(dir, { recursive: true });
    const cfg = path.join(dir, 'mcp.json');
    fs.writeFileSync(cfg, '{}');
    expect(sanitizeConfigPath(cfg)).toBe(fs.realpathSync(cfg));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('blocks symlink escape outside allowlist', () => {
    if (process.platform === 'win32') return;
    const outside = path.join(tmpDir, 'outside');
    fs.mkdirSync(outside);
    const evil = path.join(outside, 'evil.json');
    // /usr is not in unixAllowedPrefixes (/etc is allowed for system MCP configs)
    const target = '/usr/bin/true';
    if (!fs.existsSync(target)) return;
    fs.symlinkSync(target, evil);
    expect(sanitizeConfigPath(evil)).toBeNull();
  });

  it('allows path under tmp when resolved', () => {
    const cfg = path.join(tmpDir, 'mcp.json');
    fs.writeFileSync(cfg, '{}');
    const safe = sanitizeConfigPath(cfg);
    expect(safe).toBe(fs.realpathSync(cfg));
  });
});
