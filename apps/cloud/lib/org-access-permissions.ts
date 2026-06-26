import {
  apiKeyHasScope,
  userCanManageOrg,
  userCanReadOrg,
  type ApiScope,
  type OrgRole,
} from './org-rbac';

export type OrgAccessContext = {
  orgId: string;
  source: 'session' | 'apiKey';
  membershipRole: OrgRole | null;
  apiKeyScopes: ApiScope[];
};

/** Routes that mutate org state must use these helpers (see tests/org-route-rbac.test.ts). */
export const ORG_ROUTE_PERMISSIONS = [
  { method: 'GET', path: '/api/v1/policy', read: 'policy:read', write: null },
  { method: 'PUT', path: '/api/v1/policy', read: null, write: 'policy:write' },
  { method: 'POST', path: '/api/v1/policy/publish', read: null, write: 'policy:write' },
  { method: 'GET', path: '/api/v1/policy/rules', read: 'policy:read', write: null },
  { method: 'PATCH', path: '/api/v1/policy/rules', read: null, write: 'policy:write' },
  { method: 'DELETE', path: '/api/v1/policy/rules', read: null, write: 'policy:write' },
  { method: 'POST', path: '/api/v1/keys/rotate', read: null, write: 'keys:manage' },
  { method: 'PUT', path: '/api/dashboard/policy', read: null, write: 'admin+' },
] as const;

export function orgAccessCanReadPolicy(access: OrgAccessContext): boolean {
  if (access.source === 'session') {
    return userCanReadOrg({ role: access.membershipRole! });
  }
  return apiKeyHasScope(access.apiKeyScopes, 'policy:read');
}

export function orgAccessCanWritePolicy(access: OrgAccessContext): boolean {
  if (access.source === 'session') {
    return userCanManageOrg({ role: access.membershipRole! });
  }
  return apiKeyHasScope(access.apiKeyScopes, 'policy:write');
}

export function orgAccessCanManageKeys(access: OrgAccessContext): boolean {
  if (access.source === 'session') {
    return userCanManageOrg({ role: access.membershipRole! });
  }
  return apiKeyHasScope(access.apiKeyScopes, 'keys:manage');
}
