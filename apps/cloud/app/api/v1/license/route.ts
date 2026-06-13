import { extractBearerToken, extractRawBearerToken, isCloudLicenseKey } from '@/lib/api-keys';
import { allLicensedFeatures } from '@/lib/entitlements';
import { resolveOrgFromApiKey } from '@/lib/org-context';
import { findProLicenseByPlaintext } from '@/lib/pro-license-keys';
import { resolveProCheckoutUrl } from '@/lib/pro-checkout-url';
import { NextResponse } from 'next/server';

function licensePayload(opts: {
  licensed: boolean;
  tenantSlug: string;
  orgId?: string;
  orgName?: string;
  status: string;
}) {
  return {
    licensed: opts.licensed,
    tenantSlug: opts.tenantSlug,
    orgId: opts.orgId,
    orgName: opts.orgName,
    status: opts.status,
    features: opts.licensed ? [...allLicensedFeatures()] : [],
    expiresAt: null as string | null,
    graceUntil: null as string | null,
    cloudBillingUrl: resolveProCheckoutUrl(),
  };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const rawToken = extractRawBearerToken(authHeader);

  if (!rawToken) {
    return NextResponse.json({ error: 'Bearer token required' }, { status: 401 });
  }

  if (isCloudLicenseKey(rawToken)) {
    const token = extractBearerToken(authHeader) ?? rawToken;
    const ctx = await resolveOrgFromApiKey(token);
    if (!ctx) {
      return NextResponse.json(licensePayload({
        licensed: false,
        tenantSlug: 'default',
        status: 'invalid_key',
      }), { status: 401 });
    }
    return NextResponse.json(
      licensePayload({
        licensed: true,
        tenantSlug: ctx.org.slug,
        orgId: ctx.org.id,
        orgName: ctx.org.name,
        status: 'active',
      }),
    );
  }

  const proRow = await findProLicenseByPlaintext(rawToken);
  if (!proRow) {
    return NextResponse.json(licensePayload({
      licensed: false,
      tenantSlug: 'default',
      status: 'invalid_key',
    }), { status: 401 });
  }

  return NextResponse.json(
    licensePayload({
      licensed: true,
      tenantSlug: `pro-${proRow.id.slice(0, 8)}`,
      orgName: 'MCP Mastyff AI Pro',
      status: 'active',
    }),
  );
}
