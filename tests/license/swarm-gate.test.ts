import { describe, expect, it, beforeAll, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const REPO = join(import.meta.dirname, '..', '..');
const CHECK_PRO = join(REPO, 'dist', 'license', 'check-pro.js');
const RUN_SWARM = join(REPO, 'security-swarm', 'run.mjs');

describe('Security Swarm Pro gate (v3)', () => {
  const envBackup = { ...process.env };

  beforeAll(() => {
    const build = spawnSync('pnpm', ['build:mastyff-ai'], {
      cwd: REPO,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    if (build.status !== 0) {
      throw new Error(`pnpm build:mastyff-ai failed:\n${build.stderr || build.stdout}`);
    }
    expect(existsSync(CHECK_PRO)).toBe(true);
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('check-pro exits 1 without license key', () => {
    delete process.env.MASTYFF_AI_LICENSE_KEY;
    delete process.env.MASTYFF_AI_CONTROL_PLANE_URL;
    delete process.env.MASTYFF_AI_CI_BYPASS_LICENSE;
    delete process.env.MASTYFF_AI_DEV_UNLOCK_ALL;

    const r = spawnSync(process.execPath, [CHECK_PRO, 'swarm'], {
      cwd: REPO,
      encoding: 'utf8',
    });
    expect(r.status).toBe(1);
    expect(r.stderr || r.stdout).toMatch(/MCP Mastyff AI Pro required/i);
  });

  it('check-pro exits 0 with CI bypass', () => {
    delete process.env.MASTYFF_AI_LICENSE_KEY;
    process.env.MASTYFF_AI_CI_BYPASS_LICENSE = 'true';

    const r = spawnSync(process.execPath, [CHECK_PRO, 'swarm'], {
      cwd: REPO,
      encoding: 'utf8',
    });
    expect(r.status).toBe(0);
  });

  it('check-pro exits non-zero with maintainer dev unlock (removed in v3.2.3)', () => {
    delete process.env.MASTYFF_AI_LICENSE_KEY;
    delete process.env.MASTYFF_AI_CI_BYPASS_LICENSE;
    process.env.NODE_ENV = 'development';
    process.env.MASTYFF_AI_DEV_UNLOCK_ALL = 'true';

    const r = spawnSync(process.execPath, [CHECK_PRO, 'swarm'], {
      cwd: REPO,
      encoding: 'utf8',
    });
    expect(r.status).not.toBe(0);
  });

  it('run.mjs exits before swarm work without license', () => {
    delete process.env.MASTYFF_AI_LICENSE_KEY;
    delete process.env.MASTYFF_AI_CONTROL_PLANE_URL;
    delete process.env.MASTYFF_AI_CI_BYPASS_LICENSE;
    delete process.env.MASTYFF_AI_DEV_UNLOCK_ALL;

    const r = spawnSync(process.execPath, [RUN_SWARM, '--help'], {
      cwd: REPO,
      encoding: 'utf8',
      timeout: 15_000,
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr || r.stdout).toMatch(/MCP Mastyff AI Pro required|license/i);
  });
});
