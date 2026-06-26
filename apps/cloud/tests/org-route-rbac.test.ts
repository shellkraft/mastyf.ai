import { describe, expect, it } from 'vitest';
import {
  ORG_ROUTE_PERMISSIONS,
  orgAccessCanManageKeys,
  orgAccessCanReadPolicy,
  orgAccessCanWritePolicy,
  type OrgAccessContext,
} from '../lib/org-access-permissions';

function sessionAccess(role: OrgAccessContext['membershipRole']): OrgAccessContext {
  return {
    orgId: 'org-1',
    source: 'session',
    membershipRole: role,
    apiKeyScopes: [],
  };
}

function apiKeyAccess(scopes: OrgAccessContext['apiKeyScopes']): OrgAccessContext {
  return {
    orgId: 'org-1',
    source: 'apiKey',
    membershipRole: null,
    apiKeyScopes: scopes,
  };
}

describe('org route RBAC matrix', () => {
  it('documents protected org routes', () => {
    expect(ORG_ROUTE_PERMISSIONS.length).toBeGreaterThanOrEqual(6);
    expect(ORG_ROUTE_PERMISSIONS.some((r) => r.path === '/api/v1/policy' && r.method === 'PUT')).toBe(true);
    expect(ORG_ROUTE_PERMISSIONS.some((r) => r.path === '/api/v1/keys/rotate')).toBe(true);
  });

  it('viewer session cannot write policy or rotate keys', () => {
    const viewer = sessionAccess('viewer');
    expect(orgAccessCanReadPolicy(viewer)).toBe(true);
    expect(orgAccessCanWritePolicy(viewer)).toBe(false);
    expect(orgAccessCanManageKeys(viewer)).toBe(false);
  });

  it('operator session cannot manage policy or keys', () => {
    const operator = sessionAccess('operator');
    expect(orgAccessCanReadPolicy(operator)).toBe(true);
    expect(orgAccessCanWritePolicy(operator)).toBe(false);
    expect(orgAccessCanManageKeys(operator)).toBe(false);
  });

  it('admin session can write policy and rotate keys', () => {
    const admin = sessionAccess('admin');
    expect(orgAccessCanWritePolicy(admin)).toBe(true);
    expect(orgAccessCanManageKeys(admin)).toBe(true);
  });

  it('api key with badge:read only cannot write policy', () => {
    const key = apiKeyAccess(['badge:read']);
    expect(orgAccessCanReadPolicy(key)).toBe(false);
    expect(orgAccessCanWritePolicy(key)).toBe(false);
    expect(orgAccessCanManageKeys(key)).toBe(false);
  });

  it('api key with policy:write can mutate policy but not rotate keys', () => {
    const key = apiKeyAccess(['policy:read', 'policy:write']);
    expect(orgAccessCanReadPolicy(key)).toBe(true);
    expect(orgAccessCanWritePolicy(key)).toBe(true);
    expect(orgAccessCanManageKeys(key)).toBe(false);
  });

  it('api key with keys:manage can rotate keys', () => {
    const key = apiKeyAccess(['keys:manage']);
    expect(orgAccessCanManageKeys(key)).toBe(true);
    expect(orgAccessCanWritePolicy(key)).toBe(false);
  });
});

describe('policy route handlers use org-access guards', () => {
  it('PUT /api/v1/policy imports shared write guard', async () => {
    const { readFileSync } = await import('node:fs');
    const { join, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const dir = dirname(fileURLToPath(import.meta.url));
    const policyRoute = readFileSync(join(dir, '../app/api/v1/policy/route.ts'), 'utf8');
    expect(policyRoute).toContain('orgAccessCanWritePolicy');
    expect(policyRoute).toContain('resolveOrgAccess');
  });

  it('POST /api/v1/keys/rotate imports keys manage guard', async () => {
    const { readFileSync } = await import('node:fs');
    const { join, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const dir = dirname(fileURLToPath(import.meta.url));
    const rotateRoute = readFileSync(join(dir, '../app/api/v1/keys/rotate/route.ts'), 'utf8');
    expect(rotateRoute).toContain('orgAccessCanManageKeys');
    expect(rotateRoute).not.toContain('canManage: true');
  });
});
