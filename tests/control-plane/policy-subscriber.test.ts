import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('policy-subscriber', () => {
  let dir: string;
  const env = { ...process.env };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'policy-sub-'));
    process.env = { ...env };
    process.env.MASTYFF_AI_CONTROL_PLANE_URL = 'https://cloud.example.com';
    process.env.MASTYFF_AI_CLOUD_API_KEY = 'gcp_test_key';
    process.env.MASTYFF_AI_POLICY_TEMPLATES_DIR = join(dir, 'policy-templates');
    vi.resetModules();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    process.env = env;
    vi.unstubAllGlobals();
  });

  it('disabled without control plane env', async () => {
    delete process.env.MASTYFF_AI_CONTROL_PLANE_URL;
    delete process.env.MASTYFF_AI_CLOUD_API_KEY;
    const { isPolicySubscriberEnabled } = await import('../../src/control-plane/policy-subscriber.js');
    expect(isPolicySubscriberEnabled()).toBe(false);
  });

  it('is enabled when control plane URL and API key set', async () => {
    const { isPolicySubscriberEnabled } = await import('../../src/control-plane/policy-subscriber.js');
    expect(isPolicySubscriberEnabled()).toBe(true);
  });

  it('writes fetched YAML to tenant policy path and bumps version', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: (h: string) => (h === 'x-policy-version' ? '2' : null) },
      text: async () => 'policy:\n  mode: block\n  rules: []\n',
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchAndApplyCloudPolicy, resetPolicySubscriberForTests } = await import(
      '../../src/control-plane/policy-subscriber.js'
    );
    resetPolicySubscriberForTests();

    const result = await fetchAndApplyCloudPolicy('acme-corp');
    expect(result.applied).toBe(true);
    expect(result.version).toBe(2);

    const path = join(dir, 'policy-templates', 'tenants', 'acme-corp', 'policy.yaml');
    const { readFileSync } = await import('fs');
    expect(readFileSync(path, 'utf-8')).toContain('mode: block');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://cloud.example.com/api/v1/policy',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer gcp_test_key' }) }),
    );
  });

  it('skips apply when policy version unchanged', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => '1' },
        text: async () => 'policy:\n  mode: audit\n  rules: []\n',
      }),
    );

    const { fetchAndApplyCloudPolicy, resetPolicySubscriberForTests } = await import(
      '../../src/control-plane/policy-subscriber.js'
    );
    resetPolicySubscriberForTests();

    const first = await fetchAndApplyCloudPolicy('acme-corp');
    expect(first.applied).toBe(true);

    const second = await fetchAndApplyCloudPolicy('acme-corp');
    expect(second.applied).toBe(false);
  });
});
