import {
  orgAccessCanReadPolicy,
  orgAccessCanWritePolicy,
  resolveOrgAccess,
} from '@/lib/org-access';
import { publishPolicyYaml } from '@/lib/policy-publish';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
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
    const body = (await request.json()) as { yaml?: string };
    yaml = body.yaml ?? '';
  } else {
    yaml = await request.text();
  }

  if (!yaml.trim()) {
    return NextResponse.json({ error: 'Policy YAML required' }, { status: 400 });
  }

  const { version, publishedAt } = await publishPolicyYaml(access.orgId, yaml);

  return NextResponse.json({ ok: true, version, publishedAt });
}
