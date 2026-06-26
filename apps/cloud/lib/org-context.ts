import { eq, isNull } from 'drizzle-orm';
import { getDb } from './db';
import {
  apiKeys,
  organizationMembers,
  organizations,
  policies,
} from './db/schema';
import { verifyApiKey } from './api-keys';
import { userCanManageOrg as rbacCanManage, parseApiKeyScopes, apiKeyHasScope, type ApiScope } from './org-rbac';

export type UserOrgContext = {
  org: typeof organizations.$inferSelect;
  membership: typeof organizationMembers.$inferSelect;
  policy: typeof policies.$inferSelect | null;
};

export async function getUserOrg(userId: string): Promise<UserOrgContext | null> {
  const membership = await getDb().query.organizationMembers.findFirst({
    where: eq(organizationMembers.userId, userId),
  });
  if (!membership) return null;

  const org = await getDb().query.organizations.findFirst({
    where: eq(organizations.id, membership.orgId),
  });
  if (!org) return null;

  const policy = await getDb().query.policies.findFirst({
    where: eq(policies.orgId, org.id),
  });

  return { org, membership, policy: policy ?? null };
}

/** @deprecated Use getUserOrg — all orgs are active (no subscription gating). */
export async function requireActiveUserOrg(userId: string): Promise<UserOrgContext | null> {
  return getUserOrg(userId);
}

export async function resolveOrgFromApiKey(bearerToken: string): Promise<{
  org: typeof organizations.$inferSelect;
  apiKeyId: string;
  scopes: ApiScope[];
} | null> {
  const keys = await getDb()
    .select()
    .from(apiKeys)
    .where(isNull(apiKeys.revokedAt));

  for (const row of keys) {
    if (verifyApiKey(bearerToken, row.keyHash)) {
      const org = await getDb().query.organizations.findFirst({
        where: eq(organizations.id, row.orgId),
      });
      if (!org) return null;
      await getDb()
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, row.id));
      return {
        org,
        apiKeyId: row.id,
        scopes: parseApiKeyScopes((row as { scopes?: string }).scopes),
      };
    }
  }
  return null;
}

export function userCanManageOrg(membership: typeof organizationMembers.$inferSelect): boolean {
  return rbacCanManage(membership);
}
