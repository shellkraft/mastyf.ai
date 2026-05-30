import { describe, expect, it, vi, afterEach } from 'vitest';
import { runEnterpriseSecurityPreflight } from '../../src/utils/enterprise-bootstrap.js';

describe('enterprise validation matrix', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('fails preflight when enterprise strict multi-replica without Redis', () => {
    vi.stubEnv('GUARDIAN_ENTERPRISE_MODE', 'true');
    vi.stubEnv('GUARDIAN_STRICT_MODE', 'true');
    vi.stubEnv('GUARDIAN_REPLICA_COUNT', '2');
    vi.stubEnv('REDIS_URL', '');
    vi.stubEnv('GUARDIAN_SECRET_PROVIDER', 'hashicorp-vault');
    vi.stubEnv('GUARDIAN_CI_BYPASS_LICENSE', '');
    vi.stubEnv('GUARDIAN_DEV_UNLOCK_ALL', '');
    expect(() => runEnterpriseSecurityPreflight()).toThrow(/REDIS_URL/);
  });

  it('accepts configured retention and payload env vars without throwing', () => {
    vi.stubEnv('GUARDIAN_ENTERPRISE_MODE', 'false');
    vi.stubEnv('GUARDIAN_STRICT_MODE', 'false');
    vi.stubEnv('MCP_GUARDIAN_RETENTION_DAYS', '90');
    vi.stubEnv('GUARDIAN_MAX_EXPANDED_PAYLOAD_BYTES', '52428800');
    vi.stubEnv('GUARDIAN_JWKS_REFRESH_MS', '300000');
    vi.stubEnv('GUARDIAN_HEALTH_PROBE_INTERVAL_MS', '0');
    expect(() => runEnterpriseSecurityPreflight()).not.toThrow();
  });
});
