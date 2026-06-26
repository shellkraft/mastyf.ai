import { getDb } from '@/lib/db';
import { policies } from '@/lib/db/schema';
import { getDefaultPolicyYaml } from '@/lib/default-policy';
import {
  orgAccessCanReadPolicy,
  orgAccessCanWritePolicy,
  resolveOrgAccess,
} from '@/lib/org-access';
import { publishPolicyYaml } from '@/lib/policy-publish';
import { removeRule, setRuleEnabled, summarizeRules } from '@/lib/policy-rule-ops';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

async function getPolicyYaml(orgId: string): Promise<{ yaml: string; version: number }> {
  const policy = await getDb().query.policies.findFirst({
    where: eq(policies.orgId, orgId),
  });
  return { yaml: policy?.yamlContent ?? getDefaultPolicyYaml(), version: policy?.version ?? 0 };
}

export async function GET(request: Request) {
  const access = await resolveOrgAccess(request);
  if (!access || !orgAccessCanReadPolicy(access)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { yaml, version } = await getPolicyYaml(access.orgId);
  const rules = summarizeRules(yaml);
  return NextResponse.json({
    rules,
    total: rules.length,
    enabled: rules.filter((rule) => rule.enabled).length,
    disabled: rules.filter((rule) => !rule.enabled).length,
    version,
  });
}

export async function PATCH(request: Request) {
  const access = await resolveOrgAccess(request);
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgAccessCanWritePolicy(access)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { name?: string; enabled?: boolean };
  const name = String(body.name ?? '').trim();
  if (!name || typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'name and enabled(boolean) are required' }, { status: 400 });
  }
  const { yaml } = await getPolicyYaml(access.orgId);
  let nextYaml = '';
  try {
    nextYaml = setRuleEnabled(yaml, name, body.enabled);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update rule' }, { status: 400 });
  }
  const published = await publishPolicyYaml(access.orgId, nextYaml);
  const rules = summarizeRules(nextYaml);
  const warning = rules.filter((rule) => rule.enabled).length === 0
    ? 'All rules are disabled. This significantly reduces protections.'
    : undefined;
  console.info('[cloud-policy] rule toggled', {
    orgId: access.orgId,
    action: 'toggle',
    ruleName: name,
    enabled: body.enabled,
    version: published.version,
    at: published.publishedAt,
  });
  return NextResponse.json({
    ok: true,
    version: published.version,
    publishedAt: published.publishedAt,
    reloadStatus: 'cloud-policy-version-updated',
    warning,
  });
}

export async function DELETE(request: Request) {
  const access = await resolveOrgAccess(request);
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgAccessCanWritePolicy(access)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const name = String(body.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  const { yaml } = await getPolicyYaml(access.orgId);
  let nextYaml = '';
  try {
    nextYaml = removeRule(yaml, name);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to delete rule' }, { status: 400 });
  }
  const published = await publishPolicyYaml(access.orgId, nextYaml);
  const rules = summarizeRules(nextYaml);
  const warning = rules.length === 0
    ? 'Policy has no rules after deletion.'
    : undefined;
  console.info('[cloud-policy] rule deleted', {
    orgId: access.orgId,
    action: 'delete',
    ruleName: name,
    version: published.version,
    at: published.publishedAt,
    remainingRules: rules.length,
  });
  return NextResponse.json({
    ok: true,
    version: published.version,
    publishedAt: published.publishedAt,
    reloadStatus: 'cloud-policy-version-updated',
    warning,
  });
}

