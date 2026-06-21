import { describe, expect, it, beforeAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO = join(import.meta.dirname, '..', '..');
const CHECK_PRO = join(REPO, 'dist', 'license', 'check-pro.js');

describe('Security Swarm license gate (removed)', () => {
  beforeAll(() => {
    const build = spawnSync('pnpm', ['build:mastyf-ai'], {
      cwd: REPO,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    if (build.status !== 0) {
      throw new Error(`pnpm build:mastyf-ai failed:\n${build.stderr || build.stdout}`);
    }
    expect(existsSync(CHECK_PRO)).toBe(true);
  });

  it('check-pro always exits 0 (MIT open source)', () => {
    delete process.env.MASTYF_AI_LICENSE_KEY;
    delete process.env.MASTYF_AI_REQUIRE_LICENSE;

    const r = spawnSync(process.execPath, [CHECK_PRO, 'swarm'], {
      cwd: REPO,
      encoding: 'utf8',
    });
    expect(r.status).toBe(0);
  });

  it('gate-pro.mjs is legacy no-op', () => {
    const gate = readFileSync(join(REPO, 'security-swarm/lib/gate-pro.mjs'), 'utf8');
    expect(gate).toMatch(/Legacy Pro gate — removed|MIT open source/i);
  });
});
