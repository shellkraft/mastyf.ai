import { randomUUID } from 'crypto';
import { eq, and, isNull } from 'drizzle-orm';
import { generateApiKey } from '@/lib/api-keys';
import { getDb } from '@/lib/db';
import { apiKeys } from '@/lib/db/schema';
import { orgAccessCanManageKeys, resolveOrgAccess } from '@/lib/org-access';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const access = await resolveOrgAccess(request);
  if (!access) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!orgAccessCanManageKeys(access)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await getDb()
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.orgId, access.orgId), isNull(apiKeys.revokedAt)));

  const { plaintext, prefix, hash } = generateApiKey();
  await getDb().insert(apiKeys).values({
    id: randomUUID(),
    orgId: access.orgId,
    keyHash: hash,
    prefix,
    name: 'default',
  });

  return NextResponse.json({ apiKey: plaintext });
}
