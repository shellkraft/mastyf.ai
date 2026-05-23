import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  startDashboardServer,
  closeDashboardServer,
} from '../../src/utils/dashboard-server.js';

const PORT = 41397;
const VALID_POLICY = `version: "1.0"
policy:
  mode: audit
  rules: []
`;

describe('dashboard PUT /api/policy', () => {
  let tmpDir: string;
  let policyPath: string;

  beforeAll(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'dash-policy-'));
    policyPath = join(tmpDir, 'test-policy.yaml');
    process.env.DASHBOARD_ENABLED = 'true';
    process.env.DASHBOARD_AUTH_DISABLED = 'true';
    process.env.GUARDIAN_CI_BYPASS_LICENSE = 'true';
    process.env.GUARDIAN_POLICY_PATH = policyPath;
    await startDashboardServer(PORT);
  });

  afterAll(async () => {
    await closeDashboardServer();
    rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.DASHBOARD_ENABLED;
    delete process.env.DASHBOARD_AUTH_DISABLED;
    delete process.env.GUARDIAN_POLICY_PATH;
    delete process.env.GUARDIAN_CI_BYPASS_LICENSE;
  });

  it('rejects invalid YAML with 400', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/policy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yaml: 'not: [valid: policy' }),
    });
    expect(res.status).toBe(400);
  });

  it('saves valid policy YAML to GUARDIAN_POLICY_PATH', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/policy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yaml: VALID_POLICY }),
    });
    expect(res.status).toBe(200);
    expect(existsSync(policyPath)).toBe(true);
    expect(readFileSync(policyPath, 'utf-8')).toContain('mode: audit');
  });

  it('GET returns saved policy', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/policy`);
    expect(res.ok).toBe(true);
    const body = (await res.json()) as { yaml?: string; path?: string };
    expect(body.path).toBe(policyPath);
    expect(body.yaml).toContain('mode: audit');
  });
});
