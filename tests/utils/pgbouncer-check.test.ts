import { describe, it, expect, afterEach } from 'vitest';
import {
  isPgbouncerConnectionUrl,
  isDirectPostgresUrl,
  evaluatePgBouncerStartup,
} from '../../src/utils/pgbouncer-check.js';

describe('pgbouncer-check', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it('detects pgbouncer host and port 6432', () => {
    expect(isPgbouncerConnectionUrl('postgresql://u:p@pgbouncer:6432/guardian')).toBe(true);
    expect(isPgbouncerConnectionUrl('postgresql://u:p@mcp-pooler:6432/guardian')).toBe(true);
  });

  it('detects direct postgres on 5432', () => {
    expect(isDirectPostgresUrl('postgresql://u:p@postgres:5432/guardian')).toBe(true);
    expect(isDirectPostgresUrl('postgresql://u:p@pgbouncer:6432/guardian')).toBe(false);
  });

  it('errors when GUARDIAN_REQUIRE_PGBOUNCER and direct URL', () => {
    const result = evaluatePgBouncerStartup({
      dbType: 'postgres',
      databaseUrl: 'postgresql://u:p@postgres:5432/guardian',
      replicaCount: 3,
      inK8s: true,
      redisConfigured: true,
      strictMode: false,
      requirePgBouncer: true,
    });
    expect(result.action).toBe('error');
  });

  it('warns on direct postgres in k8s multi-replica', () => {
    const result = evaluatePgBouncerStartup({
      dbType: 'postgres',
      databaseUrl: 'postgresql://u:p@postgres:5432/guardian',
      replicaCount: 10,
      inK8s: true,
      redisConfigured: true,
      strictMode: false,
      requirePgBouncer: false,
    });
    expect(result.action).toBe('warn');
  });

  it('no action for sqlite', () => {
    const result = evaluatePgBouncerStartup({
      dbType: 'sqlite',
      databaseUrl: undefined,
      replicaCount: 100,
      inK8s: true,
      redisConfigured: true,
      strictMode: true,
      requirePgBouncer: true,
    });
    expect(result.action).toBe('none');
  });
});
