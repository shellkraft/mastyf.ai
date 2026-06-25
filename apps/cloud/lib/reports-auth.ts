import { extractRawBearerToken, isCloudLicenseKey } from '@/lib/api-keys';
import { resolveOrgFromApiKey } from '@/lib/org-context';

export type ReportsAuthContext =
  | { ok: true; source: 'service' }
  | { ok: true; source: 'org'; orgId: string }
  | { ok: false };

/** Authorize performance report reads via service key or org API key. */
export async function authorizeReportsRequest(request: Request): Promise<ReportsAuthContext> {
  const token = extractRawBearerToken(request.headers.get('authorization'));
  if (!token) return { ok: false };

  const serviceKey = process.env.MASTYF_REPORTS_API_KEY?.trim();
  if (serviceKey && token === serviceKey) {
    return { ok: true, source: 'service' };
  }

  if (isCloudLicenseKey(token)) {
    const orgCtx = await resolveOrgFromApiKey(token);
    if (orgCtx) {
      return { ok: true, source: 'org', orgId: orgCtx.org.id };
    }
  }

  return { ok: false };
}
