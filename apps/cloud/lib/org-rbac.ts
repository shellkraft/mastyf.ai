export type OrgRole = 'viewer' | 'operator' | 'admin' | 'owner';

const ROLE_RANK: Record<OrgRole, number> = {
  viewer: 0,
  operator: 1,
  admin: 2,
  owner: 3,
};

export function normalizeOrgRole(raw: string): OrgRole | null {
  const r = raw.trim().toLowerCase();
  if (r === 'viewer' || r === 'operator' || r === 'admin' || r === 'owner') return r;
  return null;
}

export function orgRoleAtLeast(actual: OrgRole, required: OrgRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

export function userCanReadOrg(membership: { role: string }): boolean {
  const role = normalizeOrgRole(membership.role);
  return role != null && orgRoleAtLeast(role, 'viewer');
}

export function userCanOperateOrg(membership: { role: string }): boolean {
  const role = normalizeOrgRole(membership.role);
  return role != null && orgRoleAtLeast(role, 'operator');
}

export function userCanManageOrg(membership: { role: string }): boolean {
  const role = normalizeOrgRole(membership.role);
  return role != null && orgRoleAtLeast(role, 'admin');
}

export type ApiScope =
  | 'badge:read'
  | 'deep-scan:run'
  | 'policy:read'
  | 'policy:write'
  | 'keys:manage';

export function parseApiKeyScopes(raw: string | null | undefined): ApiScope[] {
  if (!raw) return ['badge:read', 'policy:read'];
  try {
    const parsed = JSON.parse(raw) as string[];
    return parsed.filter((s): s is ApiScope =>
      ['badge:read', 'deep-scan:run', 'policy:read', 'policy:write', 'keys:manage'].includes(s));
  } catch {
    return ['badge:read', 'policy:read'];
  }
}

export function apiKeyHasScope(scopes: ApiScope[], required: ApiScope): boolean {
  return scopes.includes(required);
}
