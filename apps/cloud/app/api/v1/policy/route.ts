import {
  orgAccessCanReadPolicy,
  orgAccessCanWritePolicy,
  resolveOrgAccess,
} from '@/lib/org-access';
import { getDefaultPolicyYaml } from '@/lib/default-policy';
import { getDb } from '@/lib/db';
import { policies } from '@/lib/db/schema';
import { publishPolicyYaml } from '@/lib/policy-publish';
import { policyPutSchema } from '@/lib/api-schemas';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const access = await resolveOrgAccess(request);
  if (!access || !orgAccessCanReadPolicy(access)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const policy = await getDb().query.policies.findFirst({
    where: eq(policies.orgId, access.orgId),
  });

  return new NextResponse(policy?.yamlContent ?? getDefaultPolicyYaml(), {
    headers: {
      'Content-Type': 'text/yaml; charset=utf-8',
      'X-Policy-Version': String(policy?.version ?? 0),
    },
  });
}

export async function PUT(request: Request) {
  const access = await resolveOrgAccess(request);
  if (!access) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!orgAccessCanWritePolicy(access)) {
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

  await publishPolicyYaml(access.orgId, yaml);

  return NextResponse.json({ ok: true });
}
