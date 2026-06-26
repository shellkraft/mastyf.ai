import { extractBearerToken } from './api-keys';
import { auth } from './auth';
import { getUserOrg, resolveOrgFromApiKey } from './org-context';
import { normalizeOrgRole } from './org-rbac';
import type { OrgAccessContext } from './org-access-permissions';

export type { OrgAccessContext } from './org-access-permissions';
export {
  ORG_ROUTE_PERMISSIONS,
  orgAccessCanManageKeys,
  orgAccessCanReadPolicy,
  orgAccessCanWritePolicy,
} from './org-access-permissions';

export async function resolveOrgAccess(request: Request): Promise<OrgAccessContext | null> {
  const bearer = extractBearerToken(request.headers.get('authorization'));
  if (bearer) {
    const apiCtx = await resolveOrgFromApiKey(bearer);
    if (!apiCtx) return null;
    return {
      orgId: apiCtx.org.id,
      source: 'apiKey',
      membershipRole: null,
      apiKeyScopes: apiCtx.scopes,
    };
  }

  const session = await auth();
  if (!session?.user?.id) return null;

  const ctx = await getUserOrg(session.user.id);
  if (!ctx) return null;

  const role = normalizeOrgRole(ctx.membership.role);
  if (!role) return null;

  return {
    orgId: ctx.org.id,
    source: 'session',
    membershipRole: role,
    apiKeyScopes: [],
  };
}
