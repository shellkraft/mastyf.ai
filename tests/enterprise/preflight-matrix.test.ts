import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  isMultiReplicaDeployment,
  runEnterpriseSecurityPreflight,
} from '../../src/utils/enterprise-bootstrap.js';

describe('enterprise validation matrix', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('fails preflight when enterprise strict multi-replica without Redis', () => {
    vi.stubEnv('MASTYF_AI_ENTERPRISE_MODE', 'true');
    vi.stubEnv('MASTYF_AI_STRICT_MODE', 'true');
    vi.stubEnv('MASTYF_AI_REPLICA_COUNT', '2');
    vi.stubEnv('REDIS_URL', '');
    vi.stubEnv('MASTYF_AI_SECRET_PROVIDER', 'hashicorp-vault');
    vi.stubEnv('MASTYF_AI_CI_BYPASS_LICENSE', '');
    vi.stubEnv('MASTYF_AI_DEV_UNLOCK_ALL', '');
    expect(() => runEnterpriseSecurityPreflight()).toThrow(/REDIS_URL/);
  });

  it('accepts configured retention and payload env vars without throwing', () => {
    vi.stubEnv('MASTYF_AI_ENTERPRISE_MODE', 'false');
    vi.stubEnv('MASTYF_AI_STRICT_MODE', 'false');
    vi.stubEnv('MASTYF_AI_RETENTION_DAYS', '90');
    vi.stubEnv('MASTYF_AI_MAX_EXPANDED_PAYLOAD_BYTES', '52428800');
    vi.stubEnv('MASTYF_AI_JWKS_REFRESH_MS', '300000');
    vi.stubEnv('MASTYF_AI_HEALTH_PROBE_INTERVAL_MS', '0');
    expect(() => runEnterpriseSecurityPreflight()).not.toThrow();
  });

  it('fails preflight when strict multi-replica uses SQLite', () => {
    vi.stubEnv('MASTYF_AI_ENTERPRISE_MODE', 'false');
    vi.stubEnv('MASTYF_AI_STRICT_MODE', 'true');
    vi.stubEnv('MASTYF_AI_REPLICA_COUNT', '2');
    vi.stubEnv('DB_TYPE', 'sqlite');
    vi.stubEnv('MASTYF_AI_CI_BYPASS_LICENSE', '');
    vi.stubEnv('MASTYF_AI_DEV_UNLOCK_ALL', '');
    expect(() => runEnterpriseSecurityPreflight()).toThrow(/SQLite history DB is unsafe/);
  });
});

describe('isMultiReplicaDeployment', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.MASTYF_AI_REPLICA_COUNT;
    delete process.env.REPLICA_COUNT;
    delete process.env.KUBERNETES_SERVICE_HOST;
  });

  it('returns false for single replica', () => {
    vi.stubEnv('MASTYF_AI_REPLICA_COUNT', '1');
    expect(isMultiReplicaDeployment()).toBe(false);
  });

  it('returns true when MASTYF_AI_REPLICA_COUNT > 1', () => {
    vi.stubEnv('MASTYF_AI_REPLICA_COUNT', '3');
    expect(isMultiReplicaDeployment()).toBe(true);
  });

  it('returns true when REPLICA_COUNT > 1', () => {
    vi.stubEnv('REPLICA_COUNT', '2');
    expect(isMultiReplicaDeployment()).toBe(true);
  });

  it('does not infer multi-replica from Kubernetes alone', () => {
    vi.stubEnv('KUBERNETES_SERVICE_HOST', '10.0.0.1');
    vi.stubEnv('MASTYF_AI_REPLICA_COUNT', '1');
    expect(isMultiReplicaDeployment()).toBe(false);
  });
});
