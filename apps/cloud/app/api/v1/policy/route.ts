import { extractBearerToken } from '@/lib/api-keys';
import { auth } from '@/lib/auth';
import {
  getUserOrg,
  resolveOrgFromApiKey,
  userCanManageOrg,
} from '@/lib/org-context';
import { getDefaultPolicyYaml } from '@/lib/default-policy';
import { getDb } from '@/lib/db';
import { policies } from '@/lib/db/schema';
import { publishPolicyYaml } from '@/lib/policy-publish';
import { policyPutSchema } from '@/lib/api-schemas';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

async function resolveWriteContext(request: Request) {
  const bearer = extractBearerToken(request.headers.get('authorization'));
  if (bearer) {
    const apiCtx = await resolveOrgFromApiKey(bearer);
    if (!apiCtx) return null;
    return {
      orgId: apiCtx.org.id,
      canManage: true,
    };
  }

  const session = await auth();
  if (!session?.user?.id) return null;
  const ctx = await getUserOrg(session.user.id);
  if (!ctx) return null;
  const canManage = userCanManageOrg(ctx.membership);
  return { orgId: ctx.org.id, canManage };
}

export async function GET(request: Request) {
  const writeCtx = await resolveWriteContext(request);
  if (!writeCtx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const policy = await getDb().query.policies.findFirst({
    where: eq(policies.orgId, writeCtx.orgId),
  });

  return new NextResponse(policy?.yamlContent ?? getDefaultPolicyYaml(), {
    headers: {
      'Content-Type': 'text/yaml; charset=utf-8',
      'X-Policy-Version': String(policy?.version ?? 0),
    },
  });
}

export async function PUT(request: Request) {
  const writeCtx = await resolveWriteContext(request);
  if (!writeCtx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!writeCtx.canManage) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let yaml: string;
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = await request.json();
    const parsed = policyPutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 });
    }
    yaml = parsed.data.yaml ?? '';
  } else {
    yaml = await request.text();
  }

  if (!yaml.trim()) {
    return NextResponse.json({ error: 'Policy YAML required' }, { status: 400 });
  }

  await publishPolicyYaml(writeCtx.orgId, yaml);

  return NextResponse.json({ ok: true });
}
