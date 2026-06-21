import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  LicenseClient,
  resetLicenseClientForTests,
} from '../../src/license/license-client.js';
import {
  isOpenCoreEnabled,
  isProFeature,
  isDevUnlockAllowed,
  allProFeatureNames,
} from '../../src/license/feature-tiers.js';

describe('open-core feature tiers', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    resetLicenseClientForTests();
    delete process.env.MASTYF_AI_CI_BYPASS_LICENSE;
    delete process.env.MASTYF_AI_DEV_UNLOCK_ALL;
    delete process.env.MASTYF_AI_REQUIRE_LICENSE;
  });

  afterEach(() => {
    process.env = { ...envBackup };
    resetLicenseClientForTests();
  });

  it('is open source by default', () => {
    expect(isOpenCoreEnabled()).toBe(true);
  });

  it('dev unlock always returns false', () => {
    process.env.NODE_ENV = 'development';
    process.env.MASTYF_AI_DEV_UNLOCK_ALL = 'true';
    expect(isDevUnlockAllowed()).toBe(false);
  });

  it('classifies feature names for telemetry', () => {
    expect(isProFeature('swarm')).toBe(true);
    expect(isProFeature('proxy')).toBe(false);
    expect(allProFeatureNames().length).toBeGreaterThan(5);
  });

  it('unlocks all features without license key (open source)', () => {
    delete process.env.MASTYF_AI_CONTROL_PLANE_URL;
    delete process.env.MASTYF_AI_LICENSE_KEY;

    const client = new LicenseClient({
      requireLicense: false,
      refreshSeconds: 300,
      graceSeconds: 900,
    });

    expect(client.isLicensed()).toBe(true);
    expect(client.hasFeature('swarm')).toBe(true);
    expect(client.hasFeature('dashboard')).toBe(true);
    expect(client.hasFeature('proxy')).toBe(true);
  });

  it('allows Pro features when licensed via control plane', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        licensed: true,
        tenantSlug: 'acme',
        status: 'active',
        features: allProFeatureNames(),
        expiresAt: null,
        graceUntil: null,
        cloudBillingUrl: '',
      }),
    });

    const client = new LicenseClient({
      controlPlaneUrl: 'http://cloud',
      licenseKey: 'gcp_test',
      requireLicense: false,
      refreshSeconds: 300,
      graceSeconds: 900,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    await client.refresh();
    expect(client.getTier()).toBe('pro');
    expect(client.hasFeature('swarm')).toBe(true);
  });
});
